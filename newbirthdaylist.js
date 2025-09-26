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
                                currentDisplayMonth = person.birthday_moment.format('MMMM');
                                
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
                            let is_today = (person.days_until === 0)
                            let dim_entry = false  // Don't dim today's birthdays

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
                                    
                                    // Determine styling based on whether it's today
                                    var imageClass = "TD-IMAGE";
                                    var nameClass = "TD-BODY";
                                    var ageClass = "TD-AGE";
                                    
                                    if (is_today) {
                                        imageClass = "TD-IMAGE_TODAY";
                                        nameClass = "TD-BODY_TODAY";
                                        ageClass = "TD-AGE_TODAY";
                                    } else if (dim_entry) {
                                        imageClass = "TD-IMAGE_DIMMED";
                                        nameClass = "TD-BODY_DIMMED";
                                        ageClass = "TD-AGE_DIMMED";
                                    }
                                    
                                    if (this.config.withMonth) {
                                        imageClass += "_withmonth";
                                    }
                                    
                                    var imageTD = this.createEl('td', null, imageClass, bodyTR, displayDate ? this.getBD_DAY_from_Date(displayDate, this.config.withMonth) : "");

                                    var nameTD = this.createEl('td', null, nameClass, bodyTR, person.name + daysUntilText);

                                    // Only show age if showAge is true and it's not the no birthdays message
                                    if (this.config.showAge && !birthday.includes('no_birthdays')) {
                                        var spanTDo = this.createEl("td", null, ageClass, bodyTR, ageInfo );
                                        if(this.config.dateFormat.length){
                                            this.createEl("td", null, ageClass, bodyTR, bdInfo );
                                        }
                                    }
                                }
                                else {
                                    // add a break
                                    this.createEl('br', null , null , nameTD, null);
                                    
                                    // Determine styling for additional names
                                    var sameClass = is_today ? "TD-SAME_TODAY" : (dim_entry ? "TD-SAME_DIMMED" : "TD-SAME");
                                    
                                    // add a span with name
                                    var nameTD1 = this.createEl('span', null, sameClass, nameTD, person.name + daysUntilText);
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