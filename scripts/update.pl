#!/usr/bin/perl

use strict;
use feature 'say';
use utf8;
use open qw/:std :utf8/;
use JSON qw/from_json to_json encode_json decode_json/;

$|=1;

our %coleanddept;
our %courses;

our $DATA_FOLDER='../html/data';
our $PDATA_FOLDER='./pdata';

require './_settings.pl';
require './_subs.pl';


loadBase();
loadCourseData();

retriveCountsInfo_OldApi();		# this include counts about courses
saveCourseDataAsJSON();
uploadUpdateToServer() if($ARGV[0]);


sub uploadUpdateToServer {
	require Net::SFTP::Foreign;
	my $settings = from_json(`cat _login_info.json`);

	my $sftp = new Net::SFTP::Foreign($settings->{host},%{$settings->{args}});
	$sftp->error and die "unable to connect to remote host: " . $sftp->error;
	$sftp->setcwd($settings->{remote_path}) or die "unable to change cwd: " . $sftp->error;
	$sftp->put("$DATA_FOLDER/courses.json", "courses.json") or die "put failed: " . $sftp->error;
	say localtime(time)." data upload to remote server successfully!";
}
