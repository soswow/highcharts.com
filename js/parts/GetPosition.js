
/**
 * Take an interval and normalize it to multiples of 1, 2, 2.5 and 5
 * @param {Number} interval
 * @param {Array} multiples
 * @param {Number} magnitude
 * @param {Object} options
 */
function normalizeTickInterval(interval, multiples, magnitude, options) {
	var normalized, i;

	// round to a tenfold of 1, 2, 2.5 or 5
	//magnitude = multiples ? 1 : math.pow(10, mathFloor(math.log(interval) / math.LN10));
	magnitude = pick(magnitude, 1);
	normalized = interval / magnitude;

	// multiples for a linear scale
	if (!multiples) {
		multiples = [1, 2, 2.5, 5, 10];
		//multiples = [1, 2, 2.5, 4, 5, 7.5, 10];

		// the allowDecimals option
		if ((options && options.allowDecimals === false) || isLog) {
			if (magnitude === 1) {
				multiples = [1, 2, 5, 10];
			} else if (magnitude <= 0.1) {
				multiples = [1 / magnitude];
			}
		}
	}

	// normalize the interval to the nearest multiple
	for (i = 0; i < multiples.length; i++) {
		interval = multiples[i];
		if (normalized <= (multiples[i] + (multiples[i+1] || multiples[i])) / 2) {
			break;
		}
	}

	// multiply back to the correct magnitude
	interval *= magnitude;

	return interval;
}

/**
 * Set the tick positions to a time unit that makes sense, for example
 * on the first of each month or on every Monday. Return an array
 * with the time positions. Used in datetime axes as well as for grouping
 * data on a datetime axis.
 *
 * @param {Number} tickInterval The approximate interval in axis values (ms)
 * @param {Number} min The minimum in axis values
 * @param {Number} max The maximum in axis values
 * @param {Number} startOfWeek
 * @param {Array} unitsOption
 */
function getTimeTicks(tickInterval, min, max, startOfWeek, unitsOption) {
	var tickPositions = [],
		i,
		useUTC = defaultOptions.global.useUTC,
		oneSecond = 1000 / timeFactor,
		oneMinute = 60000 / timeFactor,
		oneHour = 3600000 / timeFactor,
		oneDay = 24 * 3600000 / timeFactor,
		oneWeek = 7 * 24 * 3600000 / timeFactor,
		oneMonth = 30 * 24 * 3600000 / timeFactor,
		oneYear = 31556952000 / timeFactor,

		ranges = hash(
			MILLISECOND, 1,
			SECOND, oneSecond,
			MINUTE, oneMinute,
			HOUR, oneHour,
			DAY, oneDay,
			WEEK, oneWeek,
			MONTH, oneMonth,
			YEAR, oneYear
		),
		units = unitsOption || [[
			'millisecond',					// unit name
			//1,								// fixed incremental unit
			[1, 2, 5, 10, 20, 25, 50, 100, 200, 500]
		], [
			'second',						// unit name
			//oneSecond,						// fixed incremental unit
			[1, 2, 5, 10, 15, 30]			// allowed multiples
		], [
			'minute',						// unit name
			//oneMinute,						// fixed incremental unit
			[1, 2, 5, 10, 15, 30]			// allowed multiples
		], [
			'hour',							// unit name
			//oneHour,						// fixed incremental unit
			[1, 2, 3, 4, 6, 8, 12]			// allowed multiples
		], [
			'day',							// unit name
			//oneDay,							// fixed incremental unit
			[1, 2]							// allowed multiples
		], [
			'week',							// unit name
			//oneWeek,						// fixed incremental unit
			[1, 2]							// allowed multiples
		], [
			'month',
			//oneMonth,
			[1, 2, 3, 4, 6]
		], [
			'year',
			//oneYear,
			null
		]],

		unit = units[units.length - 1], // default unit is years
		interval = ranges[unit[0]],
		multiples = unit[1];

	// loop through the units to find the one that best fits the tickInterval
	for (i = 0; i < units.length; i++)  {
		unit = units[i];
		interval = ranges[unit[0]];
		multiples = unit[1];


		if (units[i+1]) {
			// lessThan is in the middle between the highest multiple and the next unit.
			var lessThan = (interval * multiples[multiples.length - 1] +
						ranges[units[i + 1][0]]	) / 2;

			// break and keep the current unit
			if (tickInterval <= lessThan) {
				break;
			}
		}
	}

	// prevent 2.5 years intervals, though 25, 250 etc. are allowed
	if (interval === oneYear && tickInterval < 5 * interval) {
		multiples = [1, 2, 5];
	}

	// get the minimum value by flooring the date
	var multitude = normalizeTickInterval(tickInterval / interval, multiples),
		minYear, // used in months and years as a basis for Date.UTC()
		minDate = new Date(min * timeFactor);

	minDate.setMilliseconds(0);

	if (interval >= oneSecond) { // second
		minDate.setSeconds(interval >= oneMinute ? 0 :
			multitude * mathFloor(minDate.getSeconds() / multitude));
	}

	if (interval >= oneMinute) { // minute
		minDate[setMinutes](interval >= oneHour ? 0 :
			multitude * mathFloor(minDate[getMinutes]() / multitude));
	}

	if (interval >= oneHour) { // hour
		minDate[setHours](interval >= oneDay ? 0 :
			multitude * mathFloor(minDate[getHours]() / multitude));
	}

	if (interval >= oneDay) { // day
		minDate[setDate](interval >= oneMonth ? 1 :
			multitude * mathFloor(minDate[getDate]() / multitude));
	}

	if (interval >= oneMonth) { // month
		minDate[setMonth](interval >= oneYear ? 0 :
			multitude * mathFloor(minDate[getMonth]() / multitude));
		minYear = minDate[getFullYear]();
	}

	if (interval >= oneYear) { // year
		minYear -= minYear % multitude;
		minDate[setFullYear](minYear);
	}

	// week is a special case that runs outside the hierarchy
	if (interval === oneWeek) {
		// get start of current week, independent of multitude
		minDate[setDate](minDate[getDate]() - minDate[getDay]() +
			pick(startOfWeek, 1));
	}


	// get tick positions
	i = 1;
	minYear = minDate[getFullYear]();
	var time = minDate.getTime() / timeFactor,
		minMonth = minDate[getMonth](),
		minDateDate = minDate[getDate]();

	// iterate and add tick positions at appropriate values
	while (time < max) {
		tickPositions.push(time);

		// if the interval is years, use Date.UTC to increase years
		if (interval === oneYear) {
			time = makeTime(minYear + i * multitude, 0) / timeFactor;

		// if the interval is months, use Date.UTC to increase months
		} else if (interval === oneMonth) {
			time = makeTime(minYear, minMonth + i * multitude) / timeFactor;

		// if we're using global time, the interval is not fixed as it jumps
		// one hour at the DST crossover
		} else if (!useUTC && (interval === oneDay || interval === oneWeek)) {
			time = makeTime(minYear, minMonth, minDateDate +
				i * multitude * (interval === oneDay ? 1 : 7));

		// else, the interval is fixed and we use simple addition
		} else {
			time += interval * multitude;
		}

		i++;
	}
	// push the last time
	tickPositions.push(time);


	// record information on the chosen unit - for dynamic label formatter
	tickPositions.unit = unit;

	return tickPositions;
}
