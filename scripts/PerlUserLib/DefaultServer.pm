#!/usr/bin/perl

package DefaultServer;

use strict;
use warnings;

use utf8;
use JSON;
use HTTP::Daemon;
use HTTP::Response;
use HTTP::Status;
use URI::Encode qw/uri_encode uri_decode/;

#use DefaultClient;

my $daemon;

# my %Options = (
#     'listen-host' => '192.168.0.100',
#     'listen-port' => 8080,
#     'listen-clients' => 0,
#     'listen-max-req-per-child' => undef,  #child died when this limit exceed!
# );

my $defaultLogger=sub{
	my($client,$request,$time)=@_;
	print sprintf("%s [%s] %s %s\n", FormatTime($time,2), $client->peerhost, $request->method, $request->uri->as_string);
	utf8::decode(my $content=uri_decode($request->{_content}));
	print "REQ: ".$content."\n";
};
my $extraLogger=sub{};
my $loggingFH=undef;

my $defaultListener=sub {
	my($client,$request)=@_;
	if ($request->uri->path eq '/') {
		# my %Q=DefaultServer::parseQ($request);
		http_response(
			$client,
			{ content_type => 'text/html' },
			"<h1>Hello World!</h1>","Hello ".$client->peerhost." !"
		);
		return 1;
	}
	return 0;
};


my %pathlistener=(
	# '/'=>sub {
	#     my($client,$request)=@_;
	#     my %Q=DefaultServer::parseQ($request);
	#     http_response(
	#         $client,
	#         { content_type => 'text/html' },
	#         "<h1>Hello World!</h1>","Hello ".$Q{name}." !"
	#     );
	# }
);

my %processfunc=(
	# '/'=>sub {
	#     my %Q=%{+shift};
	#     my $R = shift;
	#     local $NAME=$Q{"name"};
	# }
);

sub new {
	return bless {}, shift;
}

sub setLogger {
	my($self,$sub,$fh)=@_;
	$extraLogger=$sub;
	$loggingFH=$fh;
}

sub setDefaultListener {
	my($self,$sub)=@_;
	$defaultListener=$sub;
}

sub setPathListener {
	# $func will be call as $func->($client,$request)
	# Accept $client and $request object, use $client to response to the client
	my($self,$path,$func)=@_;
	$pathlistener{$path}=$func;
	$processfunc{$path}=undef;
}
sub setPathProcessor {
	# $func will be call as $func->(\%INPUT,\%RESULT);
	# Accept \%INPUT and empty \%RESULT, put your result in \%RESULT and it will be sent
	my($self,$path,$func)=@_;
	$pathlistener{$path}=\&accept;
	$processfunc{$path}=$func;
}
sub accept {
	my($client,$request,$proc)=@_;

	my %Q=parseQ($request);
	process_and_send_json($client,\%Q,$proc);
}

sub startListen {
	my $self=shift;
	my ($host,$port)=split /:/, shift;
	$port=shift if(@_);
	$host//="localhost";
	$port//=80;

	$daemon = HTTP::Daemon->new(
		LocalAddr => $host,
		LocalPort => $port,
		Reuse => 1,
	) or die "Can't start http listener at $host:$port";

	print "Started HTTP listener at ".$daemon->url."\n";

	loop_child($daemon);
}

######################################################

sub loop_child {
	my $daemon = shift;      #the Daemon

	REQUEST: while (1) {
		my $client = $daemon->accept() or print STDERR "accept failed.\nREASON: Timeout.\n" and next REQUEST;
		my $request = $client->get_request();
		#1: get only header. if failed, the daemon should be discarded
		if(!$request){
			print STDERR $client->peerhost." read request failed.\nREASON: ".$client->reason."\n";
			print $loggingFH $client->peerhost." read request failed.\nREASON: ".$client->reason."\n" if($loggingFH);
			next REQUEST;
		}
		$client->autoflush(1);

		my $time=time;
		$defaultLogger->($client,$request,$time);
		$extraLogger->($client,$request,$time,$loggingFH) if(defined $extraLogger);

		my $processed;
		if (exists $pathlistener{$request->uri->path}) {
			$pathlistener{$request->uri->path}->($client,$request,$processfunc{$request->uri->path});
			$processed=1;
		}

		$processed=&$defaultListener($client,$request) if(defined $defaultListener && !$processed);

		$client->send_error(RC_NOT_FOUND) if(!$processed);

		$client->close();
	}
}

sub parseQ {
	# to use: my %Q=DefaultServer::parseQ($request);

	my $request=shift;
	my %Q;

	eval{
		if($request->method eq "GET"){
			%Q = $request->uri->query_form();     #parse uri into hash in K-V pair
		} elsif($request->method eq "POST") {
			%Q = GetQuery($request->{"_content"});
			%Q = %{decode_json($Q{"json"})};      #parse "json" in post into full-hash
		}
	};
	print $@ if($@);

	return %Q;
}

sub GetQuery
{
	my $q=shift;
	return if length($q)<=1;

	$q =~ s/%EF%BB%BF//gi;

	my $key;
	my %Q;

	foreach(split(/&/,$q))
	{
		my($key, $val) = split(/=/);
		$val =~ tr/+/ /;
		$val =~ s/%([a-fA-F0-9][a-fA-F0-9])/pack("C", hex($1))/eg;

		$Q{$key} .= "\0" if (defined($Q{$key}));
		$Q{$key} .= $val;
	}

	return %Q;
}

sub FormatTime
{
	return '--/--' if !$_[0];
	my($sec,$min,$hour,$mday,$mon,$year)=gmtime($_[0]+60*60*8);
	$mon++;
	return sprintf("%04d/%02d/%02d %02d:%02d:%02d",$year+1900,$mon,$mday,$hour,$min,$sec) if !$_[1];
	return sprintf("%02d/%02d %02d:%02d:%02d",$mon,$mday,$hour,$min,$sec) if $_[1]==2;
	return sprintf("%02d:%02d:%02d",$hour,$min,$sec) if $_[1]==1;
	return;
}

###

sub process_and_send_json
{
	my $client=shift;
	my %Q=%{+shift};
	my $func=shift;

	my $json = {};

	&$func(\%Q,$json,$client->peerhost);	# provide remote ip

	http_response(
		$client,
		{ content_type => 'application/json' },
		to_json($json)
	);
}

sub file_response {
	my $client = shift;
	$client->send_file_response(shift);

	return 1;
}

sub http_response {
	my $client = shift;
	my $options = shift;
	my @contents = @_;

	$client->send_response(
		HTTP::Response->new(
			RC_OK,
			undef,
			[
				'Content-Type' => $options->{content_type},
				'Cache-Control' => 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0',
				'Pragma' => 'no-cache',
				'Expires' => 'Thu, 01 Dec 1994 16:00:00 GMT',
			],
			join("\n", map {utf8::encode($_);$_;} @contents),
		)
	);

	return 1;
}

sub status_response {
	my $client = shift;
	my($status_code,$msg,$HttpProtocol) = @_;

	$client->send_status_line($status_code,$msg,$HttpProtocol);

	return 1;
}

###
1;
