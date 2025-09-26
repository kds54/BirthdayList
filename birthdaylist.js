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
		dimmEntries: false,  // true: dims entries and the associated
							 //       symbol when the date has expired.
							 // false: delete entries and the associated
							 //        symbol when the date has expired.
	  debug:false,
		initialLoadDelay: 0, // How many seconds to wait on a fresh start up.
							 // This is to prevent collision with all other modules also
							 // loading all at the same time. This only happens once,
							 // when the mirror first starts up.
		updateDelay: 5,       // How many seconds after midnight before a refresh
						     // This is to prevent collision with other
							 // modules refreshing at the same time.
		currentMonthOnly: false, // Set to false to show upcoming birthdays
		maxEntries: 10,
		dateFormat: '',
		ageFormat:'',
		withMonth: false, // Show month with day
		showAge: true,    // Set to false to hide age display
		upcomingDays: 90, // Look ahead this many days for birthdays
	},
	suspended: false,
	// place to save birthdays to display
    active_birthdays : { },

    timer:null,

	yeari:-1,				 // will be the array position of the year
	monthi:-1,				 // will be the array position of the month
	dayi:-1,				 // will be the array position of the  day
	separator:'',    		 // will be the separator for the date found from the data
	date_mask : ["","",""],
	date_start:0,			 // where to start extract the mm/dd from the bd string
	date_end:0,				 // where to end   extract the mm/dd from the bd string
	day_month_mask:'',  	 // used for bd in this year moment creation

	init: function(){
		Log.log(this.name + " is in init!");
	},

	start: function(){
		Log.log("Starting module: " + this.name);

		// set locale here, default: de
		moment.locale(config.language);

		// calculate next midnight and add updateDelay
		var now = moment();
		this.midnight = moment([now.year(), now.month(), now.date() + 1]).add(this.config.updateDelay, "seconds");
		this.loaded = false;
		this.scheduleUpdate(this.config.initialLoadDelay * 1000);
	},

	loaded: function(callback) {
		Log.log(this.name + " is loaded!");
		callback();
	},

	// return list of other functional scripts to use, if any (like require in node_helper)
	getScripts: function() {
		return	["moment.js"];
	},

	// return list of stylesheet files to use if any
	getStyles: function() {
		return 	[this.data.path + "/css/bdl.css"];
	},


	// return list of translation files to use, if any
	getTranslations: function() {
		return {
			// sample of list of files to specify here, if no files, do not use this routine, , or return empty list
			 en: "translations/en.json",
			 de: "translations/de.json",
			 fr: "translations/fr.json",
			 it: "translations/it.json",
			 es: "translations/es.json"
		}
	},


	// only called if the module header was configured in module config in config.js
	getHeader: function() {
		return this.data.header;
	},

	// messages received from other modules and the system (NOT from your node helper)
	// payload is a notification dependent data structure
	notificationReceived: function(notification, payload, sender) {
		// once everybody is loaded up
		if(notification === "ALL_MODULES_STARTED"){
			// send our config to our node_helper
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

	// figure out the date format from the actual strings..
	getDateLayout: function (payload) {
		var self = this
		// work with the 1st element as a model
		var info = payload[0]
		// regex to find the separator used
		const regex = /[/\-.]/;
		// get it
		this.separator = info.birth.match(regex);
		// split the birtday specified with the separator
		var date_as_array = info.birth.split(self.separator)
		// say we haven't figure out which field is the month yet
		var search_month = -1
		// if last field is long, we know we have the year field
		// or if there are just 2 fields, then we know year was left out
		if( date_as_array.length == 2  || date_as_array[2].length == 4 ) {
			self.yeari = 2;
			// start looking for the month at the start of the array
			search_month = 0
			// to extract just the mm/dd start here
			this.date_start = 0
			// to extract just the mm/dd end here
			this.date_end = 5
		}
		else {
			// else year must be first
			self.yeari = 0
			// start looking for the month at the second item of array
			search_month = 1
			// to extract just the mm/dd start here
			this.date_start = 5
			// to extract just the mm/dd end here
			this.date_end = 10
		}

		// now we need to loop thru all the birthdays and find something > 12 (year is 12 months)
		// if greater, that must be the day field
		for(bd of payload) {
			// split the birthday into its parts
			var a = bd.birth.split(self.separator)
			// loop thru the 2 array items, only 2 times
			for(var i = search_month,count = 2; i < a.length && count; i++, count--) {
				// if this value is >12,
				if(a[i] > 12) {
					// we have found he days field in the date string
					this.dayi = i
					// stop looking
					break;
				}
			}
			// if we have found the day column, break;
			if(this.dayi != -1)
				// stop looking
				break;
		}
		// looked thru all the specified birthdays and can't find a clear answer, so have to guess
		// if the day field is not found yet
		if(this.dayi == -1) {
			// if the separator is /, its likely a US date
			if(this.separator == '/'){
				// MM/DD/YYYY
				if(this.yeari == 2) {
					// set the month 1st
					this.monthi = 0
					//and day second
					this.dayi = 1
				}
				else // YYYY/MM/DD??
				{
					// set the month 1st
					this.monthi = 1
					//and day second
					this.dayi = 2
				}
			}
			else {
				// not /,
				// so more likey DD.MM
				if(this.yeari == 2) {
					this.dayi = 0
					this.monthi = 1
				}
				else { // never seen this but
					this.dayi = 1
					this.monthi = 2
				}
			}
		}
		// lets check if month is not yet set.
		// create an indicator for each field
		var m = [-1,-1,-1]
		// record what we know (default is -1 above)
		m[this.dayi] = this.dayi
		m[this.monthi] = this.monthi
		m[this.yeari] = this.yeari
		// find the index thats -1 still (if any)
		var l = m.findIndex((currentValue, index, arr)=> {
			return (currentValue == -1)
		})
		// if we found something still -1
		if(l!= undefined)
			// thats where month is
			this.monthi = l
		// set the mask fields for birthdate moment from input data
		// we know know, so just get it done, clear code later
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

	// messages received from from your node helper (NOT other modules or the system)
	// payload is a notification dependent data structure, up to you to design between module and node_helper
	socketNotificationReceived: function(notification, payload) {

		if(notification === "JSONDATA") {

			var self = this

			Log.log(this.name + " received a socket notification: " + notification + " - Payload: " + JSON.stringify(payload));

			var now = moment();
			var currentMonth = now.month();

			// clear the list
			this.active_birthdays = {}

			// get the date field layout from the data, don't assume the user knew what to specify
			this.getDateLayout(payload)

			// Create array to hold all upcoming birthdays with their info
			var upcomingBirthdays = [];

			// loop thru the birthdays from the file
			for(var birthday of payload) {

				// get the characters of birthdate, day and month, in whatever order, from wherever in the string
				// we will use this as the key in the hash
				var birth_date = birthday.birth.substring(this.date_start, this.date_end)

				// get the birthday as a moment in this year, for comparing
				var birth_date_moment = moment(birthday.birth, this.date_mask.join(this.separator))

				// Calculate next birthday occurrence
				var thisYearBirthday = moment(birth_date_moment).year(now.year());
				var nextBirthday = thisYearBirthday.clone();
				
				// If birthday has passed this year, move to next year
				if (thisYearBirthday.isBefore(now, 'day')) {
					nextBirthday.add(1, 'year');
				}

				// Calculate days until next birthday
				// Use startOf('day') to ensure we're comparing full days and add 1 to include the target day
				var daysUntil = nextBirthday.startOf('day').diff(now.startOf('day'), 'days');

				// Check if this birthday is within our upcoming days range
				if (daysUntil <= this.config.upcomingDays) {
					// get age at next birthday
					var person_age = nextBirthday.diff(birth_date_moment, 'years');
					
					// Add to upcoming array
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

			// Sort by days until birthday, then by name
			upcomingBirthdays.sort((a, b) => {
				if (a.days_until !== b.days_until) {
					return a.days_until - b.days_until;
				}
				return a.name.localeCompare(b.name);
			});

			// Convert to the original hash structure expected by getDom
			for(var i = 0; i < upcomingBirthdays.length; i++) {
				var bday = upcomingBirthdays[i];
				
				// Use a unique key that includes the date and maintains order
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

			// tell MM to call and get our content
			if(this.config.debug)
				Log.log(JSON.stringify(this.active_birthdays))
			self.updateDom();
		}

	},

	// system notification your module is being hidden
	// typically you would stop doing UI updates (getDom/updateDom) if the module is hidden
	suspend: function() {
		this.suspended=true
	},

	// system notification your module is being unhidden/shown
	// typically you would resume doing UI updates (getDom/updateDom) if the module is shown
	resume: function() {
		this.suspended=false
	},

	// create document element worker
	createEl : function (type, id, className, parent, value) {
		var el= document.createElement(type)
		if(id)
			el.id = id
		if(className)
			el.className = className
		if(parent)
			parent.appendChild(el)
		if(value) {
			var e = document.createTextNode(value)
			el.appendChild(e)
		}

		return el
	},

	// create table worker
	createTableHeader: function(parent, className, columnlabels) {
		var header = document.createElement("tr")
		for(columnName of columnlabels) {
			this.createEl("th", null, className, header, columnName)
		}
		parent.appendChild(header)
		return header
	},

	// extract the day from the bd, without leading 0
	getBD_DAY_from_Date: function(birthday, withmonth){
		// watch out if year is 1st, day might be last
		// if last, then we only have two fields (in YYYY/MM/DD), use the second one
		var day_index = -1;  // make it fail
		// if the month =0, day should be 1
				// MM/DD/YYYY
		if(this.monthi==0 && this.dayi==1)
			day_index=1
				// DD/MM/YYYY
		else if(this.monthi==1 && this.dayi==0)
			day_index=0
				// YYYY/MM/DD
		else if(this.monthi==1 && this.dayi==2)
			day_index=1
				// YYYY/DD/MM
		else if(this.monthi==2 && this.dayi==1)
			day_index=0
		// parse the date into parts
		let data = birthday.split(this.separator)
		// get the month
		let mn = data[this.monthi]
		if(mn.startsWith('0'))
			mn=mn.substring(1)
		// get the day
		let bd= data[day_index]
		let bdout=""
		if(bd.startsWith('0'))
			bd=bd.substring(1)
		if(withmonth == false){
			bdout=bd
		} else {
			if(this.monthi>day_index)
				bdout=bd+this.separator+mn
			else
				bdout=mn+this.separator+bd
		}

		return bdout
	},

    // this is the major worker of the module, it provides the
    // 	 displayable content for this module
	getDom: function() {
		var wrapper = this.createEl("div",null,null,null,null);
		if(this.suspended==false){

			if(Object.keys(this.active_birthdays).length > 0) {

				let counter = 0
				var currentDisplayMonth = "";
				var lastDisplayedMonth = "";

				// create your table here
				var table = this.createEl("table", "birthday-table","TABLE", wrapper, null);

				// create table header here, array of column names
				var table_header = this.createTableHeader(table, null, [" "," "])

				// create looped row section
				var tBody = this.createEl('tbody', "birthday-tbody", "TBODY", table, null);

				var first_time_for_birthday = {}

				// Sort keys to maintain order
				var sortedKeys = Object.keys(this.active_birthdays).sort();

				for(var birthday of sortedKeys) {

					if(this.config.maxEntries===0 || counter<this.config.maxEntries){

						first_time_for_birthday[birthday]=true

						for(var person of this.active_birthdays[birthday]) {
							if(this.config.maxEntries===0 || counter<this.config.maxEntries){
								
								// Get the month for this birthday (skip for no birthdays message)
								if (person.birthday_moment && !birthday.includes('no_birthdays')) {
									currentDisplayMonth = person.birthday_moment.format('MMMM YYYY');
									
									// Add month header if it's different from the last one
									if (currentDisplayMonth !== lastDisplayedMonth) {
										var monthRow = this.createEl('tr', null, "TR-MONTH", tBody, null);
										var monthTD = this.createEl('td', null, "TD-MONTH", monthRow, currentDisplayMonth);
										monthTD.setAttribute('colspan', '3');
										lastDisplayedMonth = currentDisplayMonth;
									}
								}

								// create looped row section
								var bodyTR = this.createEl('tr', null, "TR-BODY",tBody, null);

								let now = moment()
								let dim_entry = (person.days_until !== undefined && person.days_until === 0)

								let ageInfo = this.config.ageFormat.length ? this.config.ageFormat.replace('n', person.age) : person.age
								let bdInfo = this.config.dateFormat.length ? person.birthday_moment.format(this.config.dateFormat) : ageInfo

								// Create days until text
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

								if(this.config.dimmEntries || dim_entry==false){

									if(first_time_for_birthday[birthday] == true) {
										// Get the original birth date for display
										var displayDate = person.original_birth_date || birthday.substring(4); // Remove ordering prefix
										if (birthday.includes('no_birthdays')) {
											displayDate = "";
										}
										
										var imageTD = this.createEl('td', null, "TD-IMAGE".concat(dim_entry?"_DIMMED":'').concat(this.config.withMonth?"_withmonth":'') , bodyTR, displayDate ? this.getBD_DAY_from_Date(displayDate, this.config.withMonth) : "");

										var nameTD = this.createEl('td', null, "TD-BODY".concat(dim_entry?"_DIMMED":'') , bodyTR, person.name + daysUntilText);

										// Only show age if showAge is true and it's not the no birthdays message
										if (this.config.showAge && !birthday.includes('no_birthdays')) {
											var spanTDo = this.createEl("td", null, "TD-AGE".concat(dim_entry?"_DIMMED":''), bodyTR, ageInfo );
											if(this.config.dateFormat.length){
												this.createEl("td", null, "TD-AGE".concat(dim_entry?"_DIMMED":''), bodyTR, bdInfo );
											}
										}
									}
									else {
										// add a break
										this.createEl('br', null , null , nameTD, null);
										// add a span with name
										var nameTD1 = this.createEl('span', null, "TD-SAME".concat(dim_entry?"_DIMMED":'') ,nameTD, person.name + daysUntilText);
										if (this.config.showAge && !birthday.includes('no_birthdays')) {
											this.createEl('br', null , null , spanTDo, null);
										}
									}
									counter++;
								}
							}
							first_time_for_birthday[birthday] = false;
						}
					}
				}
				if(counter == 0){
					var bodyTR = this.createEl('tr', null, "TR-BODY",tBody, null);
					var nameTD1 = this.createEl('span', null, "TD-SAME",bodyTR, this.translate("NONE"));
				}
			}
		}

		// pass the created content back to MM to add to DOM.
		return wrapper;
	},


    scheduleUpdate: function(delay) {
		if (this.config.debugging) {
			Log.log("= = = = = = = = = = = = = = = = = = = = = = = = = = = = = =");
			Log.log("Birthdaylist IS IN DEBUG MODE!");
			Log.log("Remove 'debugging' option from config/config.js to disable.");
			Log.log("Current moment(): " + moment() + " (" + moment().format("hh:mm:ss a") + ")");
			Log.log("scheduleUpdate() delay set at: " + delay);
		}
		let nextReload = delay
		let xyz = typeof delay
		if (typeof delay == "number" && delay >= 0) {
			nextReload = moment().add(delay,'milliseconds');
		}
		if (delay > 0) {
			// Calculate the time DIFFERENCE to that next reload!
			nextReload = moment.duration(nextReload.diff(moment(), "milliseconds"));
			if (this.config.debugging) {
				var hours = Math.floor(nextReload.asHours());
				var  mins = Math.floor(nextReload.asMinutes()) - hours * 60;
				var  secs = Math.floor(nextReload.asSeconds()) - ((hours * 3600 ) + (mins * 60));
				Log.log("  nextReload should happen at: " + delay + " (" + moment(delay).format("hh:mm:ss a") + ")");
				Log.log("                  which is in: " + mins + " minutes and " + secs + " seconds.");
				Log.log("              midnight set at: " + this.midnight + " (" + moment(this.midnight).format("hh:mm:ss a") + ")");
				Log.log("= = = = = = = = = = = = = = = = = = = = = = = = = = = = = =");
			}
		}
		var self = this;
		setTimeout(function() {
			self.reloadDom();
		}, nextReload);
	},

    reloadDom: function() {
		if (this.config.debugging) {
			Log.log("          Calling reloadDom()!");
		}
		var now = moment();
		if (now > this.midnight) {
			this.updateDom(this.config.fadeSpeed * 1000);
			this.midnight = moment([now.year(), now.month(), now.date() + 1]).add(this.config.updateDelay, "seconds");
		}
		var nextRefresh = moment([now.year(), now.month(), now.date(), now.hour() + 1]);
		this.scheduleUpdate(nextRefresh);
  }

})