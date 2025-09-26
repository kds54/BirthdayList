/* global Module */

/* Magic Mirror
 * Module: birthdaylist
 *
 * Author: perlchamp@gmx.net & sdetweil@gmail.com
 * Lizenz: MIT
 */

Module.register("birthdaylist", {

	defaults: {
		language: "de",
		dimmEntries: false,
	   	debug:false,
		initialLoadDelay: 0,
		updateDelay: 5,
		currentMonthOnly: false,
		maxEntries: 10,
		dateFormat: '',
		ageFormat:'',
		withMonth: false,
		showAge: true,
		upcomingDays: 90,
	},
	suspended: false,
    active_birthdays : { },
    timer:null,
	yeari:-1,
	monthi:-1,
	dayi:-1,
	separator:'',
	date_mask : ["","",""],
	date_start:0,
	date_end:0,
	day_month_mask:'',

	init: function(){
		Log.log(this.name + " is in init!");
	},

	start: function(){
		Log.log("Starting module: " + this.name);
		moment.locale(config.language);
		var now = moment();
		this.midnight = moment([now.year(), now.month(), now.date() + 1]).add(this.config.updateDelay, "seconds");
		this.loaded = false;
		this.scheduleUpdate(this.config.initialLoadDelay * 1000);
	},

	loaded: function(callback) {
		Log.log(this.name + " is loaded!");
		callback();
	},

	getScripts: function() {
		return	["moment.js"];
	},

	getStyles: function() {
		return 	[this.data.path + "/css/bdl.css"];
	},

	getTranslations: function() {
		return {
			 en: "translations/en.json",
			 de: "translations/de.json",
			 fr: "translations/fr.json",
			 it: "translations/it.json",
			 es: "translations/es.json"
		}
	},

	getHeader: function() {
		return this.data.header;
	},

	notificationReceived: function(notification, payload, sender) {
		if(notification === "ALL_MODULES_STARTED"){
			this.sendSocketNotification("CONFIG",this.config);
		}
		if(this.config.debug){
			if (sender) {
				Log.log(this.name + " received a module notification: " + notification + " from sender: " + sender.name);
			}
			else {
				Log.log(this.name + " received a system notification: " + notification);
			}
		}
	},

	getDateLayout: function (payload) {
		var self = this
		var info = payload[0]
		const regex = /[/\-.]/;
		this.separator = info.birth.match(regex);
		var date_as_array = info.birth.split(self.separator)
		var search_month = -1
		if( date_as_array.length == 2  || date_as_array[2].length == 4 ) {
			self.yeari = 2;
			search_month = 0
			this.date_start = 0
			this.date_end = 5
		}
		else {
			self.yeari = 0
			search_month = 1
			this.date_start = 5
			this.date_end = 10
		}
		for(bd of payload) {
			var a = bd.birth.split(self.separator)
			for(var i = search_month,count = 2; i < a.length && count; i++, count--) {
				if(a[i] > 12) {
					this.dayi = i
					break;
				}
			}
			if(this.dayi != -1)
				break;
		}
		if(this.dayi == -1) {
			if(this.separator == '/'){
				if(this.yeari == 2) {
					this.monthi = 0
					this.dayi = 1
				}
				else {
					this.monthi = 1
					this.dayi = 2
				}
			}
			else {
				if(this.yeari == 2) {
					this.dayi = 0
					this.monthi = 1
				}
				else {
					this.dayi = 1
					this.monthi = 2
				}
			}
		}
		var m = [-1,-1,-1]
		m[this.dayi] = this.dayi
		m[this.monthi] = this.monthi
		m[this.yeari] = this.yeari
		var l = m.findIndex((currentValue, index, arr)=> {
			return (currentValue == -1)
		})
		if(l!= undefined)
			this.monthi = l
		this.date_mask[this.yeari] = "YYYY"
		this.date_mask[this.dayi] = "DD"
		this.date_mask[this.monthi] = "MM"
		var di = this.date_mask.findIndex((value, index, arr)=> {
			return value == 'DD'
		})
		if(di == 0)
			this.day_month_mask = "DD" + this.separator + "MM"
		else
			this.day_month_mask = "MM" + this.separator + "DD"
	},

	socketNotificationReceived: function(notification, payload) {
		if(notification === "JSONDATA") {
			var self = this
			Log.log(this.name + " received a socket notification: " + notification + " - Payload: " + JSON.stringify(payload));
			var now = moment();
			this.active_birthdays = {}
			this.getDateLayout(payload)
			var upcomingBirthdays = [];
			for(var birthday of payload) {
				var birth_date = birthday.birth.substring(this.date_start, this.date_end)
				var birth_date_moment = moment(birthday.birth, this.date_mask.join(this.separator))
				var thisYearBirthday = moment(birth_date_moment).year(now.year());
				var nextBirthday = thisYearBirthday.clone();
				if (thisYearBirthday.isBefore(now, 'day')) {
					nextBirthday.add(1, 'year');
				}
				var daysUntil = nextBirthday.startOf('day').diff(now.startOf('day'), 'days');
				if (daysUntil <= this.config.upcomingDays) {
					var person_age = nextBirthday.diff(birth_date_moment, 'years');
					upcomingBirthdays.push({
						name: birthday.name,
						age: person_age,
						birthday_moment: nextBirthday,
						birth_date: birth_date,
						days_until: daysUntil,
						original_birth_moment: birth_date_moment
					});
				}
			}
			upcomingBirthdays.sort((a, b) => {
				if (a.days_until !== b.days_until) {
					return a.days_until - b.days_until;
				}
				return a.name.localeCompare(b.name);
			});
			for(var i = 0; i < upcomingBirthdays.length; i++) {
				var bday = upcomingBirthdays[i];
				var key = String(i).padStart(3, '0') + '_' + bday.birth_date;
				if(self.active_birthdays[key] == undefined) {
					self.active_birthdays[key] = []
				}
				self.active_birthdays[key].push({
					'name': bday.name, 
					'age': bday.age, 
					'birthday_moment': bday.birthday_moment,
					'days_until': bday.days_until,
					'original_birth_date': bday.birth_date
				});
			}
			Log.log("number of upcoming birthdays=" + upcomingBirthdays.length)
			if(upcomingBirthdays.length === 0){
				this.active_birthdays["000_no_birthdays"] = [{
					name: "No upcoming birthdays", 
					age: 0, 
					birthday_moment: now,
					days_until: -1
				}];
			}
			if(this.config.debug)
				Log.log(JSON.stringify(this.active_birthdays))
			self.updateDom();
		}
	},

	getDom: function() {
		var wrapper = this.createEl("div",null,null,null,null);
		if(this.suspended==false){
			if(Object.keys(this.active_birthdays).length > 0) {
				let counter = 0
				var currentDisplayMonth = "";
				var lastDisplayedMonth = "";
				var table = this.createEl("table", "birthday-table","TABLE", wrapper, null);
				var table_header = this.createTableHeader(table, null, [" "," "])
				var tBody = this.createEl('tbody', "birthday-tbody", "TBODY", table, null);
				var first_time_for_birthday = {}
				var sortedKeys = Object.keys(this.active_birthdays).sort();
				for(var birthday of sortedKeys) {
					if(this.config.maxEntries===0 || counter<this.config.maxEntries){
						first_time_for_birthday[birthday]=true
						for(var person of this.active_birthdays[birthday]) {
							if(this.config.maxEntries===0 || counter<this.config.maxEntries){
								if (person.birthday_moment && !birthday.includes('no_birthdays')) {
									currentDisplayMonth = person.birthday_moment.format('MMMM');
									if (currentDisplayMonth !== lastDisplayedMonth) {
										var monthRow = this.createEl('tr', null, "TR-MONTH", tBody, null);
										var monthTD = this.createEl('td', null, "TD-MONTH", monthRow, currentDisplayMonth);
										monthTD.setAttribute('colspan', '3');
										lastDisplayedMonth = currentDisplayMonth;
									}
								}
								let isToday = (person.days_until === 0);
								let ageInfo = this.config.ageFormat.length ? this.config.ageFormat.replace('n', person.age) : person.age
								let bdInfo = this.config.dateFormat.length ? person.birthday_moment.format(this.config.dateFormat) : ageInfo
								let daysUntilText = "";
								if (person.days_until !== undefined && person.days_until >= 0) {
									if (person.days_until === 0) {
										daysUntilText = " (Today!)";
									} else if (person.days_until === 1) {
										daysUntilText = " (Tomorrow)";
									} else if (person.days_until <= 7) {
										daysUntilText = " (in " + person.days_until + " days)";
									}
								}
								if(first_time_for_birthday[birthday] == true) {
									var displayDate = person.original_birth_date || birthday.substring(4);
									if (birthday.includes('no_birthdays')) {
										displayDate = "";
									}
									var bodyTR = this.createEl('tr', null, isToday ? "TR-TODAY" : "TR-BODY",tBody, null);
									this.createEl('td', null, "TD-IMAGE".concat(this.config.withMonth?"_withmonth":''), bodyTR, displayDate ? this.getBD_DAY_from_Date(displayDate, this.config.withMonth) : "");
									var nameTD = this.createEl('td', null, isToday ? "TD-BODY_TODAY" : "TD-BODY" , bodyTR, person.name + daysUntilText);
									if (this.config.showAge && !birthday.includes('no_birthdays')) {
										var spanTDo = this.createEl("td", null, isToday ? "TD-AGE_TODAY" : "TD-AGE", bodyTR, ageInfo );
										if(this.config.dateFormat.length){
											this.createEl("td", null, isToday ? "TD-AGE_TODAY" : "TD-AGE", bodyTR, bdInfo );
										}
									}
								}
								else {
									this.createEl('br', null , null , nameTD, null);
									this.createEl('span', null, isToday ? "TD-BODY_TODAY" : "TD-SAME" ,nameTD, person.name + daysUntilText);
									if (this.config.showAge && !birthday.includes('no_birthdays')) {
										this.createEl('br', null , null , spanTDo, null);
									}
								}
								counter++;
							}
							first_time_for_birthday[birthday] = false;
						}
					}
				}
				if(counter == 0){
					var bodyTR = this.createEl('tr', null, "TR-BODY",tBody, null);
					this.createEl('span', null, "TD-SAME",bodyTR, this.translate("NONE"));
				}
			}
		}
		return wrapper;
	}
})
