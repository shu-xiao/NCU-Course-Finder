use utf8;

our %LANG = (TW => "zh-TW", EN => "en-US");
our $ncu_api_root = "https://api.cc.ncu.edu.tw/course/v1";
our $ncu_api_token = `cat _ncu_api_token.txt`;
our $ncu_api_header = {
	"Accept-Language" => $LANG{TW},
	"X-NCU-API-TOKEN" => $ncu_api_token,
};
our $course_endpoint = "https://course.ncu.edu.tw/Course/main/support/course.xml";
our $course_priority_endpoint = "https://course.ncu.edu.tw/Course/main/query/byKeywords";
our $course_header = {
	"Accept-Language" => $LANG{TW},
};

our %i18nmap = (
	language => {
		Chinese => "中文",
		English => "英語",
		French => "法語",
		Taiwanese => "台語",
		Hakka => "客語",
		Japanese => "日本語",
		Spanish => "西班牙語",
		German => "德語",
		'Partially English' => "部份英語",
	},
	passwordCard => {
		no => "不使用",
		optional => "部份使用",
		all => "全部使用",
	},
	type => {
		required => "必修",
		elective => "選修",
	},
	fullHalf => {
		full => "全",
		half => "半",
	},
);
our %re_i18nmap; {
	%{$re_i18nmap{$_}} = reverse %{$i18nmap{$_}} for(keys %i18nmap);
	$re_i18nmap{language}{"國語"} = "Chinese";
	$re_i18nmap{language}{"日語"} = "Japanese";
	$re_i18nmap{language}{"部分英語"} = "Partially English";
}

1;
