#!/usr/bin/perl

use strict;
use feature 'say';
use utf8;
use open qw/:std :utf8/;

# $|=1;

our %coleanddept;
our %courses;

our $DATA_FOLDER='../html/data';
our $PDATA_FOLDER='./pdata';

require './_settings.pl';
require './_subs.pl';


fetchBase();
saveBaseData();
saveBaseDataAsJSON();

fetchCourseData_NewApi();		# this include info about courses
saveCourseData();
