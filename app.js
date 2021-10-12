// ==UserScript==
// @name     Rescuetime Recommendations
// @version  1
// @grant    none
// ==/UserScript==


const TARGET_RATE = 15;

/***** Goals *****/

class Goal {
    constructor(name, targetTime, targetHour) {
        this.name = name;  // The name of your goal
        this.targetTime = targetTime;  // Hours you want to work for
        this.targetHour = targetHour;  // Hour you want to work until (24-hour)
    }
}

// Key: Value -- Goal ID: Goal
const GOALS = {
    "11164221": new Goal("Software Development", 4, 19)
}


function getGoal() {
    const goalId = window.location.href.split('/').pop();
    console.log(goalId);
    return GOALS[goalId];
}

/***** Time functions *****/


function hoursToSeconds(time) {
    return time * 3600;
}


function millisecondsToSeconds(time) {
    return time/1000;
}

function minutesToSeconds(time) {
    return time * 60;
}

/***** Rescuetime Page Functions *****/


function getTimeText() {
    return document.getElementsByClassName('widget-window-block-counter')[0].textContent;
}


function timeTextToSeconds(text) {
    const timeArray = text.split(' ');
    console.log(timeArray);
    let minutes = 0;
    let hours = 0;

    if (timeArray.length === 2) {
        hours = parseInt(timeArray[0]);
        minutes = parseInt(timeArray[1]);
    } else if (timeArray.length === 1) {
        hours = 0;
        minutes = parseInt(timeArray[0]);
        console.log(minutes);
    } else {
        hours = 0;
        minutes = 0;
    }
    return (hours * 3600) + (minutes * 60)
}


/***** Work Recommender *****/


class WorkRecommender {
    constructor(targetTime, targetRate, targetHour, timeSpentOnActivity=0) {
        this.targetTime = parseFloat(targetTime);  // hours you want to work
        this.targetRate = parseInt(targetRate);  // minutes
        this.targetHour = parseInt(targetHour); // the hour you want to work until, 24h
        this.timeSpentOnActivity = parseInt(timeSpentOnActivity); // seconds
    }

    get targetTimeSeconds() {
        return hoursToSeconds(this.targetTime);
    }

    get timeInDayRemaining() {
        /* How many seconds before you reach your target hour */
        const now = new Date();
        let target = new Date();
        target.setHours(this.targetHour);
        target.setMinutes(0);
        target.setSeconds(0);
        target.setMilliseconds(0);
        let timeRemaining = target - now;
        return millisecondsToSeconds(timeRemaining);
    }

    get workTimeRemaining() {
        /* How many more seconds you need to work */
        return this.targetTimeSeconds - this.timeSpentOnActivity;
    }

    get recommendedWorkRate() {
        /* How much you need to work in hours per minute */
        const minutesInAnHour = 60;
        return minutesInAnHour * (this.workTimeRemaining / this.timeInDayRemaining);
    }

    get movingTargetHour() {
        /* If you miss your self imposed deadline, this will move your deadline to to midnight */
        const currentTime = new Date();
        let newTargetHour = this.targetHour > currentTime.getHours() ?  24 : this.targetHour;
        // Move deadline to 1AM if it's 11PM to prevent weird errors.
        if (currentTime.getHours() >= 23) newTargetHour = 25;
        return newTargetHour
    }

    movingRecommendation() {
        const currentTime = new Date();
        let secondsToNextHour = 3600 - minutesToSeconds(currentTime.getMinutes());
        secondsToNextHour = secondsToNextHour > minutesToSeconds(45) ? minutesToSeconds(45) : secondsToNextHour;

        let targetWork = this.targetTimeSeconds;
        let projectedWorkTime = (this.movingTargetHour-currentTime.getHours()-1) * minutesToSeconds(this.targetRate);
        let minimumSecondsToWorkPerHour = currentTime.getMinutes() < 38 ? minutesToSeconds(20) : 0;
        let workRemaining = targetWork - (projectedWorkTime + this.timeSpentOnActivity);

        let ahead_of_goal = function() {return workRemaining < minimumSecondsToWorkPerHour};
        let behind_goal = function () {return workRemaining > secondsToNextHour};

        while (ahead_of_goal() || behind_goal()) {
            if (ahead_of_goal()) { targetWork += minutesToSeconds(20); }
            else if (behind_goal()) { targetWork -= minutesToSeconds(1); }
            workRemaining = targetWork - (projectedWorkTime + this.timeSpentOnActivity);
        }

        // Times 10 and divided by 10 needed for decimal places.
        const recommendedWorkHours = Math.round(targetWork / 3600 * 10) / 10;
        const recommendedWorkThisHour = Math.ceil(workRemaining / 60);

        return [recommendedWorkHours, recommendedWorkThisHour];
    }

    get projectedWorkHours() {
        return this.movingRecommendation()[0];
    }

    get recommendedWorkThisHour() {
        return this.movingRecommendation()[1];
    }

    get recommendedWorkNeeded() {
        // How much you need to work in order to get recommendedWorkRate down to
        // your targetRate
        let workNeeded = 0;
        let futureRecommendedWorkRate = this.recommendedWorkRate;
        let futureTimeRemaining = this.timeInDayRemaining;
        let workRemaining = this.workTimeRemaining;
        let futureWorkRemaining;
        let futureTimeSpent;
        while (futureRecommendedWorkRate > this.targetRate) {
            // how much work in seconds you would do, if you went at your target rate
            // futureWorkDone?
            futureWorkRemaining = (this.targetRate * futureTimeRemaining)/60;
            // how much time would that have taken, assuming you did that work above
            futureTimeSpent = workRemaining - futureWorkRemaining;
            // how much time would be left, after you spent that time.
            futureTimeRemaining -= futureTimeSpent;

            futureRecommendedWorkRate = (futureWorkRemaining/futureTimeRemaining) * 60;
            workRemaining = futureWorkRemaining;
            workNeeded += futureTimeSpent;
            if (futureTimeSpent < 2) {
                break; // no need to be too precise. If time spent is less than 2 seconds, break.
            }
        }
        return workNeeded / 60;
    }
}


function main() {
    // Get the time worked, time recommended, and generate text.
    const timeSpent = timeTextToSeconds(getTimeText());
    const workingGoal = getGoal();
    const wr = new WorkRecommender(workingGoal.targetTime, TARGET_RATE, workingGoal.targetHour, timeSpent);
    console.log("There's no problem here (2).");
    // "You need to work 23 minutes per hour to hit 4h by 23h"
    // "You probably want to work on it for 96 minutes"
    const workRate = wr.recommendedWorkRate;
    const workNeeded = wr.recommendedWorkNeeded;

    const workRateText = `You need to work ${Math.round(workRate)} minutes per hour to hit ${workingGoal.targetTime} by ${workingGoal.targetHour}h`;
    const workNeededText = `You probably want to work on it for ${Math.round(workNeeded)} minutes.`

    let timerWidget = document.getElementById('widget-window-data-wrapper');

    if (document.getElementById('recommendation-text') !== null) {
        let newDiv = document.getElementById('recommendation-text');
        newDiv.textContent = `\r\n${workRateText} \r\n\r\n`
        newDiv.textContent += `${workNeededText}`;
    } else {
        let newDiv = document.createElement('div');
        newDiv.id = 'recommendation-text';
        newDiv.setAttribute('style', 'white-space: pre;');
        newDiv.textContent = `${workRateText} \r\n\r\n`
        newDiv.textContent += `${workNeededText}`;
        timerWidget.appendChild(newDiv);
    }
}


setInterval(main, 5000);