#!/usr/bin/perl

use strict;
use warnings;

use utf8;
use JSON;
use HTTP::Daemon;
use HTTP::Response;
use HTTP::Status;

package DefaultClient;
our @ISA = ('HTTP::Daemon::ClientConn');

sub new {
	return bless {}, shift;
}



1;
