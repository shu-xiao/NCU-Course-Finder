use feature 'say';
use utf8;
use open qw/:std :utf8/;
use JSON qw/from_json to_json encode_json decode_json/;
use XML::Parser;
use Data::Dumper;
	$Data::Dumper::Indent = 1;	# indent mode 1
use HTML::TreeBuilder::LibXML;
	HTML::TreeBuilder::LibXML->replace_original(); # replace HTML::TreeBuilder::XPath->new

use lib './PerlUserLib';
use DefaultAgent;

our $agent = new DefaultAgent;
our $xmlparser = new XML::Parser(Style=>"Objects");


sub fetchBase {
	print "fetching colleges list...";
	for(1){
		my $resp=$agent->GET($ncu_api_root."/colleges",$ncu_api_header);
		my $result=decode_json($resp->decoded_content);
		for my $r(@$result){
			$coleanddept{$r->{id}}={};
			$coleanddept{$r->{id}}{name}=$r->{name};
		}
	}
	print "OK\n";

	print "fetching departments list...";
	for my $college_id(keys %coleanddept){
		my $resp=$agent->GET($ncu_api_root."/colleges/".$college_id."/departments",$ncu_api_header);
		my $result=decode_json($resp->decoded_content);
		for my $r(@$result){
			$coleanddept{$college_id}{departments}{$r->{id}}={};
			$coleanddept{$college_id}{departments}{$r->{id}}{name}=$r->{name};
		}
	}
	say "OK";
}

sub loadBase {
	do "$PDATA_FOLDER/coleanddept.data.pl";
	say "base data loaded.";
}

sub fetchCourseData_NewApi {

	my $error_counter = 0;
	my $counter = 0;

	print "fetching courses list & data...";

	for my $college_id(keys %coleanddept) {
		for my $department_id(keys %{$coleanddept{$college_id}{departments}}) {
			
			$counter++;
			# print "\rfetching courses list & data...($counter/? depts)";
			
			my $resp=$agent->GET($ncu_api_root."/departments/".$department_id."/courses", $ncu_api_header);
			if($resp->is_success) {
				my $result=decode_json($resp->decoded_content);
				for my $r(@$result) {
					my $no = 0+$r->{serialNo};
					$courses{$no}={};
					$courses{$no}->{serialNo} = $no;
					for my $atrb(qw(
						no
						classNo
						name
						credit
						teachers
						classRooms
						maxStudents
					)) {
						# memo
						$courses{$no}->{$atrb}=$r->{$atrb};
					}
					for my $atrb(qw(
						language
						passwordCard
						type
						fullHalf
					)) {
						$courses{$no}->{$atrb}=$re_i18nmap{$atrb}{$r->{$atrb}}
							or warn $atrb."=".$r->{$atrb}." is an invalid value at No. ".$no;
					}
					for my $atrb(qw(
						isClosed
						isMasterDoctor
						isFirstRun
						isPreSelect
					)) {
						$courses{$no}->{$atrb}=($r->{$atrb}?1:0);
					}
					$courses{$no}->{times}=&deflate_newapi_times($r->{times});
					$courses{$no}->{colecode}=$college_id;
					$courses{$no}->{deptcode}=$department_id;
					$courses{$no}->{new_api}=1;		# mark
				}
			} else {
				print STDERR "HTTP GET error code: ", $resp->code, "\n";
			    print STDERR "HTTP GET error message: ", $resp->message, "\n";
			    if(++$error_counter>5){
			    	print "\n";
					say "retrieve extra course info failed too many times, abort.";
			    	print STDERR "too much errors!\n";
			    	return;
			    }
			    redo;
			}
		}
	}
	print "\n";
	say "fetch course data finished!";
}

sub retriveCountsInfo_OldApi {

	my $error_counter = 0;
	my $counter = 0;
	my $total_courses = scalar(keys %courses);

	print "retrieving extra course info...";

	for my $college_id(keys %coleanddept) {
		for my $department_id(keys %{$coleanddept{$college_id}{departments}}) {
			
			my $resp = $agent->GET($course_endpoint."?id=".$department_id, $course_header);
			if($resp->is_success) {

			    my $raw_xml = $resp->decoded_content;
			    utf8::decode($raw_xml);
			    my $xml=$xmlparser->parsestring($raw_xml);
			    my @arr = grep {$_->isa('Course')} @{$xml->[0]->{Kids}};

			    for my $course(@arr) {
		
					$counter++;
					# print "\rretrieving extra course info...($counter/$total_courses)";
		
			    	my $no=$course->{SerialNo};
			    	for(qw(
			    		admitCnt
					    limitCnt
					    waitCnt
					)) {
			    		$courses{$no}->{$_}=0+$course->{$_};
			    	}

			    	# use old api data if new's doesn't exist
			    	if(!$courses{$no}->{new_api}) {
			    		$courses{$no}->{serialNo}=0+$no;
				    	$courses{$no}->{teachers}=[split /,\s*/, $course->{Teacher}];
				    	$courses{$no}->{times}=[map {my $a=$_;$a=~s/(.)(.)/$1-$2/;$a;} split /,/, $course->{ClassTime}];
				    	($courses{$no}->{no},$courses{$no}->{classNo}) = $course->{ClassNo}=~/^(.*)(.)$/;
				    	$courses{$no}->{name}=$course->{Title};
				    	$courses{$no}->{passwordCard}=lc $course->{passwordCard};
				    	$courses{$no}->{passwordCard}='no' if($courses{$no}->{passwordCard} eq 'none');
				    	$courses{$no}->{credit}=0+$course->{credit};
						$courses{$no}->{colecode}=$college_id;
						$courses{$no}->{deptcode}=$department_id;
					}

			    	$courses{$no}->{old_api}=1;		# mark
			    }
			} else {
			    print STDERR "HTTP GET error code: ", $resp->code, "\n";
			    print STDERR "HTTP GET error message: ", $resp->message, "\n";
			    if(++$error_counter>5){
			    	print "\n";
					say "retrieve extra course info failed too many times, abort.";
					print STDERR "too much errors!\n";
			    	return;
			    }
			    redo;
			}
		}
	}
	print "\n";
	say "retrieve extra course info finished!";
}

sub displayResultInfo {
	my $allcnt=scalar(values %courses);
	my $oldcnt=scalar(grep {defined $_->{old_api}} values %courses);
	say "old API: ".$oldcnt."(".($allcnt-$oldcnt)." missed)";
	my $newcnt=scalar(grep {defined $_->{new_api}} values %courses);
	say "new API: ".$newcnt."(".($allcnt-$newcnt)." missed)";
	my $crossedcnt=scalar(grep {defined $_->{old_api} and defined $_->{new_api}} values %courses);
	say "crossed: ".$crossedcnt;
}

sub saveBaseData {
	open(OUT,">$PDATA_FOLDER/coleanddept.data.pl");
	print OUT Data::Dumper->Dump([\%coleanddept],["*coleanddept"]);
	close(OUT);
	print "coleanddept saved. >$PDATA_FOLDER/coleanddept.data.pl\n";
}

sub saveBaseDataAsJSON {
	open(OUT,">$DATA_FOLDER/coleanddept.json");
	print OUT to_json(\%coleanddept);
	close(OUT);
	print "coleanddept saved. >$DATA_FOLDER/coleanddept.json\n";
}

sub saveCourseData {
	open(OUT,">$PDATA_FOLDER/courses.data.pl");
	# $Data::Dumper::Purity=1;
	print OUT '$LAST_UPDATE_TIME = '.time.";\n";
	print OUT Data::Dumper->Dump([\%courses],["*courses"]);
	close(OUT);
	say "courses data saved! >$PDATA_FOLDER/courses.data.pl";
}

sub saveCourseDataAsJSON {
	open(OUT,">$DATA_FOLDER/courses.json");
	print OUT to_json({LAST_UPDATE_TIME=>time,courses=>\%courses});
	close(OUT);
	say "courses data saved as json! >$DATA_FOLDER/courses.json";
}

sub loadCourseData {
	do "$PDATA_FOLDER/courses.data.pl";
	say "courses data loaded.";
}

sub deflate_newapi_times {
	CORE::state $newapi_timemapping=[
		'1','2','3','4','Z',
		'5','6','7','8','9',
		'A','B','C','D'
	];	# important!

	my $ret=[];
	for my $day(keys %{$_[0]}) {
		for my $hour(@{$_[0]->{$day}}) {
			push @$ret, $day."-".$newapi_timemapping->[$hour-1];
		}
	}
	return $ret;
}

sub make_cookie {
	join "", map {"$_=$_[0]->{$_};"} keys %{$_[0]};
}

sub objdump {
	Data::Dumper->Dump([@_]);
}
