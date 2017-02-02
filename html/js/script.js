(function(){
	"use strict";
	
	var Q;
	var CE;
	var VS, VC, VR, VTS;
	var course_info_page = "https://course.ncu.edu.tw/Course/main/support/courseDetail.html";
	var COURSEDATA;
	// var MAX_DISPLAY_ROWS = 99999;
	var coleanddept;
	var options = [
		"college", "department",
		"coursenames", "coursename_opt",
		"teachers", "teacher_opt",
		"credits",
		"reqtype",
		"category",
		"pwcard",
		"semester",
		"schedule_periods", "schedule_opts",
		"extra_opts",
	];
	var i18nmap = {
	   "pwcard_ch": {
	      "no" : "不使用",
	      "optional" : "部份使用",
	      "all" : "全部使用"
	   },
	   "reqtype_ch": {
	      "required" : "必修",
	      "elective" : "選修"
	   },
	   "fullHalf_ch": {
	      "full" : "全",
	      "half" : "半"
	   },
	   "language_ch": {
	      "Chinese" : "中文",
	      "English" : "英語",
	      "French" : "法語",
	      "Taiwanese" : "台語",
	      "Hakka" : "客語",
	      "Japanese" : "日本語",
	      "Spanish" : "西班牙語",
	      "German" : "德語",
	      "Partially English" : "部份英語"
	   }
	};

	$(document).ready(function() {

		Q = GetHashQuery();
		CE = GetCachedDOMElements();
		VS = GetValueSupplier();
		VC = GetValueConsumer();
		VR = GetValueResetter();
		VTS = GetValueToString();

		$.get("./annoinfo.txt?ts=" + Date.now(), function(data) {
			$("#annoinfo").html(data);
		});
		$.get("./daily_counter.cgi?ts=" + Date.now(), function(data) {
			$("#daily_count").text(data);
		});

		$("#datatime").css('color','red').text("正在取得資料...");
		
		new Promise(function(resolve, reject) {
			$.getJSON("data/coleanddept.json?ts=" + Date.now(), function(json) {
				coleanddept = json;
			}).done(resolve).fail(reject);
		}).then(function() {
			TableSorter_Init();
			UI_Init();
		}).then(function() {
			return new Promise(function(resolve, reject) {
				$.getJSON("data/courses.json?ts=" + Date.now(), function(json) {
					COURSEDATA = json.courses;
					Object.keys(COURSEDATA).forEach(function(courseId,i,a) {
						var course = COURSEDATA[courseId];
						if(course.limitCnt === undefined) return;
						course.remainCnt = course.limitCnt - course.admitCnt;
						course.successRate = (course.waitCnt ? (Math.floor(1000*course.remainCnt / course.waitCnt ) / 10) : "∞");
						if(course.remainCnt === 0) course.successRate = 0;
						// if(course.limitCnt === 0) course.successRate='';
						course.fullRate = (course.limitCnt ? (Math.floor(1000*course.admitCnt / course.limitCnt ) / 10) : " - ");
					});
					var LUT_DATE = new Date(json.LAST_UPDATE_TIME * 1000);
					$("#datatime").text(
						LUT_DATE.getFullYear() + "/" + (1 + LUT_DATE.getMonth()) + "/" + LUT_DATE.getDate() + " " +
						pad0(LUT_DATE.getHours()) + ":" +
						pad0(LUT_DATE.getMinutes()) +
						" (" + aGetTime(Math.floor(Date.now()/1000) - json.LAST_UPDATE_TIME) + "前)"
					).css('color','black');
					$('.startSearch').prop('disabled', false);
				}).done(resolve).fail(reject);
			});
		}).then(function() {
			Object.keys(CE).forEach(function(key,i,a) {
				VR[key]();
			});
			if(Q) {
				Object.keys(CE).forEach(function(key,i,a) {
					if(Q[key] !== undefined)
						VC[key](Q[key]);
				});
				doQuery();
			}
			onSearchChanged();
		}).catch(function(e) {
			$("#datatime").text("無法取得資料").css('color','red');
			console.log(e);
		});

		$("#disclaimer").html(
			"本網站為站長個人興趣所架設，初選期間，資料不定時更新，<br>" +
			"此工具僅供方便查詢之用，不保證內容完全正確無誤，實際請依照學校網站的資料為主，<br>" +
			"因使用本網站造成的任何損失，本站長不負任何責任，<br>" +
			"有任何問題或BUG回報請至此連結發佈處，謝謝。"
		).dialog({
			title: "※※免責聲明※※",
			modal: true,
			width: 'auto',
			draggable: false,
			resizable: false
		});
		$(".ui-widget-overlay").click(function() {
		    $("#disclaimer").dialog("close");
		});
	});

	function TableSorter_Init() {
		$.tablesorter.addParser({
			id: 'partnumber',
			is: function(s) {return false;}, 
			format: function(s) {
				return s.replace(/ \/.*$/,'');
			}, 
			type: 'numeric'
		});
		$.tablesorter.addParser({ 
			id: 'percent2',
			is: function(s) {return false;}, 
			format: function(s) {
				var n = s.replace(/%$/,'');
				if(n === ' - ') return '-9e9';
				else if(n === '∞') return '9e9';
				else return n;
			}, 
			type: 'numeric'	// set type, either numeric or text
		});
	}
	function UI_Init() {

		// tablesorter & tablesorterPager
		$("#result_table")
			.tablesorter({ 
				headers: { 
					4: {sorter:'digit'},
					5: {sorter:'digit', string: "min"},
					6: {sorter:'digit', string: "max"},
					7: {sorter:'digit', string: "min"},
					8: {sorter:'digit', string: "min"}
				} 
			})
			.tablesorterPager({
				container: $("#pager"),
				size: 50,
				output: ' 共找到 {totalRows} 筆結果 目前顯示第 {page}/{totalPages} 頁 '
			});

		// colleges and departments selection
		var colesel$ = $("#colesel");
			colesel$.append("<option value=''>" + "[不指定]" + "</option>");
		window.deptsels[''] = $("<select class='form-control'></select>");
		for(var ckey in coleanddept) {
			var coleopt = $("<option value='" + ckey + "'>" + coleanddept[ckey].name + "</option>");
			colesel$.append(coleopt);

			var depts = coleanddept[ckey].departments;
			var deptsel$ = $("<select class='form-control'></select>");
				var deptopt0$ = $("<option value=''>" + "[不指定]" + "</option>");
				deptsel$.append(deptopt0$);
			for(var dkey in depts) {
				var deptopt$ = $("<option value='" + dkey + "'>" + depts[dkey].name + "</option>");
				deptsel$.append(deptopt$);
			}
			window.deptsels[ckey]=deptsel$;
		}

		colesel$.on('change', function(event) {
			onCollegeChanged(this.value);
		});

		CE['schedule_opts'].on('change', onScheduleChanged);

		$('#searching_table').on('change', onSearchChanged);
		
		$('.startSearch').on('click', doQuery);

		var clipboard = new Clipboard('.clipboard-btn');

		////////////////////////////////////////////////////////
		var title_tmp = $("#my_title").text();
		$("#my_title").mouseover(function() {
			$("#my_title").text("NeverCareU Course Finder 2.0");
		}).mouseout(function() {
			$("#my_title").text(title_tmp);
		});

		// $('#my_footer>a').on('click', function() {
			
		// });
		////////////////////////////////////////////////////////
	}

	function doQuery() {

		var query = {};
		options.forEach(function(e,i,a) {
			query[e] = VS[e]();
		});

		var result_table_body = $("#result_table>tbody");

		result_table_body
			.empty()
			.append("<tr class='searching'><td colspan='10'>搜尋中...</td></tr>");

		var result_courses = getCoursesByQuery(query);

		var unit = 100;
		var trs = [];
		processBlock(0);

		function processBlock(ui) {

			for(var uj = 0 ; uj < unit ; uj++) {

				var i = ui*unit + uj;

				var course = result_courses[i];
				trs.push(makeCourseRow(course));

				if(i === result_courses.length-1) {
					finishQuery();
					return;
				}
			}

			setTimeout(function(){
				processBlock(ui+1);
			}, 0);
		}

		function finishQuery() {
			result_table_body.empty();
			trs.forEach(function(e,i,a){
				result_table_body.append(e);
			});
			if(result_courses.length > 1000) 
				result_table_body.prepend(
					"<tr class='warning'><td colspan='10'>" +
						"<i>※篩選條件過少可能導致結果筆數太多以至於搜尋/排序速度緩慢，請多加留意※</i>" +
					"</td></tr>"
				);
			if(result_courses.length === 0) 
				result_table_body.append(
					"<tr class='warning'><td colspan='10'>" +
						"<i>找不到相符的結果" + (query.category ? "（有可能是使用了類別篩選忘記關閉）" : "") + "</i>" +
					"</td></tr>"
				);
			
			$("#result_table").trigger("update"); 
		}
	}
	function getCoursesByQuery(query) {

		var courses = Object.keys(COURSEDATA).map(function(key) {return COURSEDATA[key];});

		if(query.department) {
			courses = courses.filter(function(course) {
				return course.deptcode === query.department;
			});
		} else if(query.college) {
			courses = courses.filter(function(course) {
				return course.colecode === query.college;
			});
		}

		if(query.coursenames) {
			if(query.coursename_opt === 'and') {
				courses = courses.filter(function(course) {
					var grep = true;
					query.coursenames.forEach(function(e,i,a) {
						var name = e;
						var inverse = false;
						if(name.charAt(0) === '!') {
							inverse = true;
							name = name.substr(1);
						}
						if(!(inverse ^ new RegExp(name).test(course.name)))
							grep = false;
					});
					return grep;
				});
			} else if(query.coursename_opt === 'or') {
				courses = courses.filter(function(course) {
					var grep = false;
					query.coursenames.forEach(function(e,i,a) {
						var name = e;
						var inverse = false;
						if(name.charAt(0) === '!') {
							inverse = true;
							name = name.substr(1);
						}
						if(inverse ^ new RegExp(name).test(course.name))
							grep = true;
					});
					return grep;
				});
			}
		}
		if(query.teachers) {
			var teacherRegexp = new RegExp("(" + query.teachers.join('|') + ")");
			if(query.teacher_opt === 'or') {
				courses = courses.filter(function(course) {
					return course.teachers.join('\n').match(teacherRegexp);
				});
			} else if(query.teacher_opt === 'nor') {
				courses = courses.filter(function(course) {
					return !course.teachers.join('\n').match(teacherRegexp);
				});
			}
		}
		if(query.credits) {
			courses = courses.filter(function(course) {
				return query.credits.indexOf(course.credit) !== -1;
			});
		}
		if(query.reqtype) {
			courses = courses.filter(function(course) {
				return course.type === query.reqtype;
			});
		}
		if(query.category) {
			courses = courses.filter(function(course) {
				return new RegExp("^" + query.category).test(course.no);
			});
		}
		if(query.pwcard) {
			courses = courses.filter(function(course) {
				return course.passwordCard === query.pwcard;
			});
		}
		if(query.semester) {
			courses = courses.filter(function(course) {
				return course.fullHalf === query.semester;
			});
		}
		
		if(query.schedule_periods) {
			if(query.schedule_opts === 'include') {
				courses = courses.filter(function(course) {
					var grep = false;
					course.times.forEach(function(hour) {
						if(query.schedule_periods.indexOf(hour) !== -1) grep = true;
					});
					return grep;
				});
			} else if(query.schedule_opts === 'enclose') {
				courses = courses.filter(function(course) {
					var grep = true;
					course.times.forEach(function(hour) {
						if(query.schedule_periods.indexOf(hour) === -1) grep = false;
					});
					return grep;
				});
			} else if(query.schedule_opts === 'exclude') {
				courses = courses.filter(function(course) {
					var grep = true;
					course.times.forEach(function(hour) {
						if(query.schedule_periods.indexOf(hour) !== -1) grep = false;
					});
					return grep;
				});
			}
		}
		if(query.extra_opts) {
			if(query.extra_opts.indexOf('isNotFull') !== -1) {
				courses = courses.filter(function(course) {
					return course.remainCnt > 0;
				});
			} else if(query.extra_opts.indexOf('isFirstRun') !== -1) {
				courses = courses.filter(function(course) {
					return course.isFirstRun === 1;
				});
			}
		}

		return courses;
	}
	function makeCourseRow(course) {
		
		[
			"credit",
			"waitCnt", "admitCnt",
			"remainCnt", "limitCnt",
			"successRate", "fullRate"
		].forEach(function(e,i,a){
			if(course[e] === undefined) course[e] = " - ";
		});

		var tr = $("<tr class='result_row'></tr>");
		
		var deptname = coleanddept[course.colecode].departments[course.deptcode].name;
		tr.append("<td class='c_no'>" +
			"<abbr title='" + deptname + "'>" +
				course.no + (course.classNo !== '*' ? course.classNo : "") +
			"</abbr>" +
		"</td>");
		var nametr = $("<td class='c_name' style='position: relative;'></td>");
			nametr.append(makeInfoBadge(course));
			nametr.append("<a target='_blank' href='" + course_info_page + "?crs=" + course.serialNo + "'>" +
				course.name +
			"</a>");
		tr.append(nametr);
		tr.append("<td class='c_teacher'>" + course.teachers.join(",<br>") + "</td>");
		tr.append("<td class='c_sr'>" + (
			/^CC/.test(course.no) ? 
				"<span class='label label-sm label-primary'>核心通識</span>" :
			/^GS/.test(course.no) ? 
				"<span class='label label-sm label-success'>一般通識</span>" :
			i18nmap.reqtype_ch[course.type] === '必修' ?
				"<span class='label label-md label-primary'>必修</span>" :
			i18nmap.reqtype_ch[course.type] === '選修' ?
				"<span class='label label-md label-success'>選修</span>" :
			"<span class='label label-md label-warning'>N/A</span>"
		) + "</td>");
		tr.append("<td class='c_credit'>" + course.credit + "</td>");
		tr.append("<td class='c_rw'>" + course.remainCnt + " / " + course.waitCnt + "</td>");
		tr.append("<td class='c_succrate' style='background: linear-gradient(90deg, " +
			"rgba(0,255,0,1) " + trimTo100(course.successRate) + "%, " +
			"rgba(0,0,0,0) " + trimTo100(course.successRate) + "%);'>" +
				course.successRate + (course.successRate !== "" ? "%" : "") +
		"</td>");
		tr.append("<td class='c_al'>" + course.admitCnt + " / " + course.limitCnt + "</td>");
		tr.append("<td class='c_fullrate' style='background: linear-gradient(90deg, " +
			"rgba(255,165,0,1) " + trimTo100(course.fullRate) + "%, " +
			"rgba(0,0,0,0) " + trimTo100(course.fullRate) + "%);'>" +
				course.fullRate + (course.fullRate !== "" ? "%" : "") +
		"</td>");
		tr.append("<td class='c_timevals'>" + course.times.join(", ") + "</td>");

		return tr;
	}
	function makeInfoBadge(course) {
		var infobadge = $("<div class='hovered-badge' style='right: 0; background-color: #22222222; position: absolute;'></div>");
		
		if(!course.old_api)
			infobadge.append("<span class='label label-info' title='只取得其中一個資料來源，資訊可能不完整(old-api-missing)'>" +
				"<span class='small glyphicon glyphicon-minus-sign' />不完整" +
			"</span>");
		if(!course.new_api)
			infobadge.append("<span class='label label-info' title='只取得其中一個資料來源，資訊可能不完整(new-api-missing)'>" +
				"<span class='small glyphicon glyphicon-minus-sign' />不完整" +
			"</span>");
		if(course.passwordCard === 'all')
			infobadge.append("<span class='label label-yellow-warning' title='需要密碼卡'>" +
				"<span class='small glyphicon glyphicon-lock' />" +
			"</span>");	
		if(!course.isFirstRun)
			infobadge.append("<span class='label label-danger' title='不開放初選'>" +
				"<span class='small glyphicon glyphicon-remove' />初選" +
			"</span>");
		if(course.isPreSelect)
			infobadge.append("<span class='label label-success' title='系統自動加選課程'>" +
				"<span class='small glyphicon glyphicon-ok' />預選" +
			"</span>");

		return infobadge;
	}

	function onSearchChanged() {
		$('#share_link').val(
			(window.location.origin !== 'null' ? window.location.origin : 'file://') +
			window.location.pathname +
			GetOptionsToHash()
		);
	}
	function onCollegeChanged(college) {
		$("#deptdiv").empty();
		if(college !== '')
			$("#deptdiv").append(window.deptsels[college]);
	}
	function onScheduleChanged() {
		if (VS['schedule_opts']() === '') {
			CE['schedule_periods'].attr('disabled', true);
		} else {
			CE['schedule_periods'].attr('disabled', false);
		}
	}

	function aGetTime(tm) {
		var s = tm % 60;
		if(tm<60)return s + ' 秒';
		
		var m = (tm-s) % 3600;
		if(tm<3600)return (m/60) + ' 分鐘';
		
		var h = (tm-s-m) % (3600*24);
		if(tm<24*3600)return (h/3600) + ' 小時 ' + (m ? (m/60) + ' 分':'');
		
		var d = (tm-s-m-h);
		return (d/3600/24) + ' 天 ' + (h/3600) + ' 小時';
	}
	function toQueryString(obj) {
		return Object.keys(obj)
			.filter(function(k){
				return obj[k] !== undefined && obj[k] !== '';
			})
			.map(function(k){return k + '=' + encodeURIComponent(obj[k]);}).join('&');
	}
	function trimTo100(n) {
		if(n === '∞')
			return 100;
		if(n === ' - ' || n<0)
			return 0;
		if(n>100)
			return 100;
		return n;
	}
	function pad0(n) {
		return (n<10) ? "0" + n : "" + n;
	}

	function GetHashQuery() {
		if(!window.location.hash)
			return undefined;
		var kvstrs = window.location.hash.substr(1).split('&');
	    var Q = {};
	    kvstrs.forEach(function(e,i,a) {
	    	var kv = e.split('=', 2);
	    	if(kv.length === 2)
	        	Q[kv[0]] = decodeURIComponent(kv[1]);
	    });
	    if(window.location.hash)
			window.history.pushState("", document.title, window.location.pathname);
	    return Q;
	}
	function GetOptionsToHash() {
		var strs = {};
		options.forEach(function(e,i,a) {
			strs[e] = VTS[e]();
		});
		return '#' + toQueryString(strs);
	}
	function GetCachedDOMElements() {
		return {
			college: $("#colesel"),
			department: window.deptsels = {},
			coursenames: $("#search_name input[type = text]"),
			coursename_opt: $("#search_name input[name = name_opt]"),
			teachers: $("#search_teacher input[type = text]"),
			teacher_opt: $("#search_teacher input[name = teacher_opt]"),
			credits: $("#filter_credit input[name = credit]"),
			reqtype: $("#filter_require input[name = type]"),
			category: $("#filter_category"),
			pwcard: $("#filter_pwcard input[name = passwordCard]"),
			semester: $("#filter_semester input[name = fullHalf]"),
			schedule_periods: $("#schedule_table input[type = checkbox]"),
			schedule_opts: $("#filter_schedule input[name = filter_mode]"),
			extra_opts: $("#extra_options input[type = checkbox]"),
		};
	}
	function GetValueResetter() {
		var basicValueResetter = {
			text: function(name) {return function() {
				CE[name].val('');
			};},
			select: function(name) {return function() {
				CE[name].val('');
			};},
			multi_select: function(name1, namefunc2) {return function() {
				// CE[name1][namefunc2()].val('');
			};},
			radio: function(name) {return function() {
				CE[name].first().prop('checked', true);
			};},
			checkbox: function(name, data) {return function() {
				CE[name].prop('checked',false);
				data.forEach(function(e,i,a) {
					CE[name].filter("[value=" + e + "]").prop('checked',true);
				});
			};},
		};
		return {
			college: basicValueResetter.select('college'),
			department:  basicValueResetter.multi_select('department', function() {return CE.college.val();}),
			coursenames: basicValueResetter.text('coursenames'),
			coursename_opt: basicValueResetter.radio('coursename_opt'),
			teachers: basicValueResetter.text('teachers'),
			teacher_opt: basicValueResetter.radio('teacher_opt'),
			credits: basicValueResetter.checkbox('credits', [0,1,2,3,4]),
			reqtype: basicValueResetter.radio('reqtype'),
			category: basicValueResetter.select('category'),
			pwcard: basicValueResetter.radio('pwcard'),
			semester: basicValueResetter.radio('semester'),
			schedule_periods: basicValueResetter.checkbox('schedule_periods', []),
			schedule_opts: basicValueResetter.radio('schedule_opts'),
			extra_opts: basicValueResetter.checkbox('extra_opts', []),
		};
	}
	function GetValueSupplier() {
		var basicValueSupplier = {
			text_plain: function(name) {return function() {
				return CE[name].val();
			};},
			text_array: function(name, delim) {return function() {
				var arr = CE[name].val()
					.trim().split(delim).filter(function(e) {return e !== '';});
				return arr.length > 0 ? arr : undefined;
			};},
			select: function(name, defaultval) {return function() {
				return CE[name].val() || defaultval;
			};},
			multi_select: function(name1, namefunc2, defaultval) {return function() {
				return CE[name1][namefunc2()].val() || defaultval;
			};},
			radio: function(name) {return function() {
				return CE[name].filter(":checked").val();
			};},
			checkbox: function(name, valfunc) {return function() {
				var arr = CE[name].filter(":checked").toArray()
					.map(function(e) {return valfunc(e.value);});
				return arr.length > 0 ? arr : undefined;
			};},
		};
		return {
			college: basicValueSupplier.select('college', undefined),
			department:  basicValueSupplier.multi_select('department', function() {return CE.college.val();}, undefined),
			coursenames: basicValueSupplier.text_array('coursenames', /\s+/),
			coursename_opt: basicValueSupplier.radio('coursename_opt'),
			teachers: basicValueSupplier.text_array('teachers', /\s+/),
			teacher_opt: basicValueSupplier.radio('teacher_opt'),
			credits: basicValueSupplier.checkbox('credits', window.parseInt),
			reqtype: basicValueSupplier.radio('reqtype'),
			category: basicValueSupplier.select('category', ''),
			pwcard: basicValueSupplier.radio('pwcard'),
			semester: basicValueSupplier.radio('semester'),
			schedule_periods: basicValueSupplier.checkbox('schedule_periods', function(e) {return e;}),
			schedule_opts: basicValueSupplier.radio('schedule_opts'),
			extra_opts: basicValueSupplier.checkbox('extra_opts', function(e) {return e;}),
		};
	}
	function GetValueConsumer() {
		var basicValueConsumer = {
			text: function(name) {return function(data) {
				CE[name].val(data);
			};},
			select: function(name) {return function(data) {
				CE[name].val(data);
			};},
			multi_select: function(name1, namefunc2, defaultval) {return function(data) {
				CE[name1][namefunc2()].val(data);
			};},
			radio: function(name) {return function(data) {
				CE[name].filter("[value = " + data + "]").prop('checked', true);
			};},
			checkbox: function(name) {return function(data) {
				CE[name].prop('checked',false);
				data.split(",").filter(function(e) {return e !== '';}).forEach(function(e,i,a) {
					CE[name].filter("[value=" + e + "]").prop('checked',true);
				});
			};},
			withCallback: function(func, callback) {return function() {
				func.call(this, Array.prototype.slice.call(arguments));
				callback();
			};},
		};
		return {
			college: basicValueConsumer.select('college'),
			department:  basicValueConsumer.multi_select('department', function() {return CE.college.val();}, ''),
			coursenames: basicValueConsumer.text('coursenames'),
			coursename_opt: basicValueConsumer.radio('coursename_opt'),
			teachers: basicValueConsumer.text('teachers'),
			teacher_opt: basicValueConsumer.radio('teacher_opt'),
			credits: basicValueConsumer.checkbox('credits'),
			reqtype: basicValueConsumer.radio('reqtype'),
			category: basicValueConsumer.select('category'),
			pwcard: basicValueConsumer.radio('pwcard'),
			semester: basicValueConsumer.radio('semester'),
			schedule_periods: basicValueConsumer.checkbox('schedule_periods'),
			schedule_opts: basicValueConsumer.withCallback(
				basicValueConsumer.radio('schedule_opts'), onScheduleChanged
			),
			extra_opts: basicValueConsumer.checkbox('extra_opts'),
		};
	}
	function GetValueToString() {
		var basicStringifier = {
			text: function(name) {return function() {
				return CE[name].val();
			};},
			select: function(name) {return function() {
				return CE[name].val() || '';
			};},
			multi_select: function(name1, namefunc2) {return function() {
				return CE[name1][namefunc2()].val() || '';
			};},
			radio: function(name) {return function() {
				return CE[name].filter(":checked").val();
			};},
			checkbox: function(name, delim) {return function() {
				return CE[name].filter(":checked").toArray()
					.map(function(e) {return e.value;})
					.join(delim);
			};},
		};
		return {
			college: basicStringifier.select('college'),
			department:  basicStringifier.multi_select('department', function() {return CE.college.val();}),
			coursenames: basicStringifier.text('coursenames'),
			coursename_opt: basicStringifier.radio('coursename_opt'),
			teachers: basicStringifier.text('teachers'),
			teacher_opt: basicStringifier.radio('teacher_opt'),
			credits: basicStringifier.checkbox('credits', ','),
			reqtype: basicStringifier.radio('reqtype'),
			category: basicStringifier.select('category'),
			pwcard: basicStringifier.radio('pwcard'),
			semester: basicStringifier.radio('semester'),
			schedule_periods: basicStringifier.checkbox('schedule_periods', ','),
			schedule_opts: basicStringifier.radio('schedule_opts'),
			extra_opts: basicStringifier.checkbox('extra_opts', ','),
		};
	}

})();
