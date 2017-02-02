#!/usr/bin/perl

use strict;
use warnings;

use utf8;
use LWP::UserAgent;

package DefaultAgent;

sub new {
	my $self = bless {}, shift;
	init($self);
	return $self;
}

sub init {
	my($self)=@_;
	$self->{UserAgent} = LWP::UserAgent->new();
}

sub GET {
	my($self,$server_endpoint,$header_ref,$data_ref)=@_;

	my $req = HTTP::Request->new(
		GET => $server_endpoint.($data_ref ? "?".(join "&", map {"$_=$data_ref->{$_}"} grep {defined $data_ref->{$_}} keys %$data_ref) : "")
	);
	$req->header(%$header_ref) if($header_ref);

	return $self->{UserAgent}->request($req);
}

sub POST {
	my($self,$server_endpoint,$header_ref,$data_ref)=@_;

	my $req = HTTP::Request->new(
		POST => $server_endpoint
	);
	$req->header(%$header_ref) if($header_ref);
	
	$req->content(to_querystr($data_ref));

	return $self->{UserAgent}->request($req);
}

sub to_querystr {
	my %Q=%{+shift};
	
	my @kvarr;
	push @kvarr, $_."=".$Q{$_} for(keys %Q);
	
	return join "&", @kvarr;
}

1;
