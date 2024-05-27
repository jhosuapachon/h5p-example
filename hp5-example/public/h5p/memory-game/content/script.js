var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var H5P = H5P || {};

/**
 * H5P-Timer
 *
 * General purpose timer that can be used by other H5P libraries.
 *
 * @param {H5P.jQuery} $
 */
H5P.Timer = function ($, EventDispatcher) {
  /**
   * Create a timer.
   *
   * @constructor
   * @param {number} [interval=Timer.DEFAULT_INTERVAL] - The update interval.
   */
  function Timer() {
    var interval = arguments.length <= 0 || arguments[0] === undefined ? Timer.DEFAULT_INTERVAL : arguments[0];

    var self = this;

    // time on clock and the time the clock has run
    var clockTimeMilliSeconds = 0;
    var playingTimeMilliSeconds = 0;

    // used to update recurring notifications
    var clockUpdateMilliSeconds = 0;

    // indicators for total running time of the timer
    var firstDate = null;
    var startDate = null;
    var lastDate = null;

    // update loop
    var loop = null;

    // timer status
    var status = Timer.STOPPED;

    // indicate counting direction
    var mode = Timer.FORWARD;

    // notifications
    var notifications = [];

    // counter for notifications;
    var notificationsIdCounter = 0;

    // Inheritance
    H5P.EventDispatcher.call(self);

    // sanitize interval
    if (Timer.isInteger(interval)) {
      interval = Math.max(interval, 1);
    }
    else {
      interval = Timer.DEFAULT_INTERVAL;
    }

    /**
     * Get the timer status.
     *
     * @public
     * @return {number} The timer status.
     */
    self.getStatus = function () {
      return status;
    };

    /**
     * Get the timer mode.
     *
     * @public
     * @return {number} The timer mode.
     */
    self.getMode = function () {
      return mode;
    };

    /**
     * Get the time that's on the clock.
     *
     * @private
     * @return {number} The time on the clock.
     */
    var getClockTime = function getClockTime() {
      return clockTimeMilliSeconds;
    };

    /**
     * Get the time the timer was playing so far.
     *
     * @private
     * @return {number} The time played.
     */
    var getPlayingTime = function getPlayingTime() {
      return playingTimeMilliSeconds;
    };

    /**
     * Get the total running time from play() until stop().
     *
     * @private
     * @return {number} The total running time.
     */
    var getRunningTime = function getRunningTime() {
      if (!firstDate) {
        return 0;
      }
      if (status !== Timer.STOPPED) {
        return new Date().getTime() - firstDate.getTime();
      }
      else {
        return !lastDate ? 0 : lastDate.getTime() - firstDate;
      }
    };

    /**
     * Get one of the times.
     *
     * @public
     * @param {number} [type=Timer.TYPE_CLOCK] - Type of the time to get.
     * @return {number} Clock Time, Playing Time or Running Time.
     */
    self.getTime = function () {
      var type = arguments.length <= 0 || arguments[0] === undefined ? Timer.TYPE_CLOCK : arguments[0];

      if (!Timer.isInteger(type)) {
        return;
      }
      // break will never be reached, but for consistency...
      switch (type) {
        case Timer.TYPE_CLOCK:
          return getClockTime();
          break;
        case Timer.TYPE_PLAYING:
          return getPlayingTime();
          break;
        case Timer.TYPE_RUNNING:
          return getRunningTime();
          break;
        default:
          return getClockTime();
      }
    };

    /**
     * Set the clock time.
     *
     * @public
     * @param {number} time - The time in milliseconds.
     */
    self.setClockTime = function (time) {
      if ($.type(time) === 'string') {
        time = Timer.toMilliseconds(time);
      }
      if (!Timer.isInteger(time)) {
        return;
      }
      // notifications only need an update if changing clock against direction
      clockUpdateMilliSeconds = (time - clockTimeMilliSeconds) * mode < 0 ? time - clockTimeMilliSeconds : 0;
      clockTimeMilliSeconds = time;
    };

    /**
     * Reset the timer.
     *
     * @public
     */
    self.reset = function () {
      if (status !== Timer.STOPPED) {
        return;
      }
      clockTimeMilliSeconds = 0;
      playingTimeMilliSeconds = 0;

      firstDate = null;
      lastDate = null;

      loop = null;

      notifications = [];
      notificationsIdCounter = 0;
      self.trigger('reset', {}, {bubbles: true, external: true});
    };

    /**
     * Set timer mode.
     *
     * @public
     * @param {number} mode - The timer mode.
     */
    self.setMode = function (direction) {
      if (direction !== Timer.FORWARD && direction !== Timer.BACKWARD) {
        return;
      }
      mode = direction;
    };

    /**
     * Start the timer.
     *
     * @public
     */
    self.play = function () {
      if (status === Timer.PLAYING) {
        return;
      }
      if (!firstDate) {
        firstDate = new Date();
      }
      startDate = new Date();
      status = Timer.PLAYING;
      self.trigger('play', {}, {bubbles: true, external: true});
      update();
    };

    /**
     * Pause the timer.
     *
     * @public
     */
    self.pause = function () {
      if (status !== Timer.PLAYING) {
        return;
      }
      status = Timer.PAUSED;
      self.trigger('pause', {}, {bubbles: true, external: true});
    };

    /**
     * Stop the timer.
     *
     * @public
     */
    self.stop = function () {
      if (status === Timer.STOPPED) {
        return;
      }
      lastDate = new Date();
      status = Timer.STOPPED;
      self.trigger('stop', {}, {bubbles: true, external: true});
    };

    /**
     * Update the timer until Timer.STOPPED.
     *
     * @private
     */
    var update = function update() {
      var currentMilliSeconds = 0;
      // stop because requested
      if (status === Timer.STOPPED) {
        clearTimeout(loop);
        return;
      }

      //stop because countdown reaches 0
      if (mode === Timer.BACKWARD && clockTimeMilliSeconds <= 0) {
        self.stop();
        return;
      }

      // update times
      if (status === Timer.PLAYING) {
        currentMilliSeconds = new Date().getTime() - startDate;
        clockTimeMilliSeconds += currentMilliSeconds * mode;
        playingTimeMilliSeconds += currentMilliSeconds;
      }
      startDate = new Date();

      checkNotifications();

      loop = setTimeout(function () {
        update();
      }, interval);
    };

    /**
     * Get next notification id.
     *
     * @private
     * @return {number} id - The next id.
     */
    var getNextNotificationId = function getNextNotificationId() {
      return notificationsIdCounter++;
    };

    /**
     * Set a notification
     *
     * @public
     * @param {Object|String} params - Parameters for the notification.
     * @callback callback - Callback function.
     * @return {number} ID of the notification.
     */
    self.notify = function (params, callback) {
      var id = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : getNextNotificationId();

      // common default values for the clock timer
      // TODO: find a better place for this, maybe a JSON file?
      var defaults = {};
      defaults['every_tenth_second'] = { "repeat": 100 };
      defaults['every_second'] = { "repeat": 1000 };
      defaults['every_minute'] = { "repeat": 60000 };
      defaults['every_hour'] = { "repeat": 3600000 };

      // Sanity check for callback function
      if (!callback instanceof Function) {
        return;
      }

      // Get default values
      if ($.type(params) === 'string') {
        params = defaults[params];
      }

      if (params !== null && (typeof params === 'undefined' ? 'undefined' : _typeof(params)) === 'object') {
        // Sanitize type
        if (!params.type) {
          params.type = Timer.TYPE_CLOCK;
        }
        else {
          if (!Timer.isInteger(params.type)) {
            return;
          }
          if (params.type < Timer.TYPE_CLOCK || params.type > Timer.TYPE_RUNNING) {
            return;
          }
        }

        // Sanitize mode
        if (!params.mode) {
          params.mode = Timer.NOTIFY_ABSOLUTE;
        }
        else {
          if (!Timer.isInteger(params.mode)) {
            return;
          }
          if (params.mode < Timer.NOTIFY_ABSOLUTE || params.type > Timer.NOTIFY_RELATIVE) {
            return;
          }
        }

        // Sanitize calltime
        if (!params.calltime) {
          params.calltime = params.mode === Timer.NOTIFY_ABSOLUTE ? self.getTime(params.type) : 0;
        }
        else {
          if ($.type(params.calltime) === 'string') {
            params.calltime = Timer.toMilliseconds(params.calltime);
          }
          if (!Timer.isInteger(params.calltime)) {
            return;
          }
          if (params.calltime < 0) {
            return;
          }
          if (params.mode === Timer.NOTIFY_RELATIVE) {
            params.calltime = Math.max(params.calltime, interval);
            if (params.type === Timer.TYPE_CLOCK) {
              // clock could be running backwards
              params.calltime *= mode;
            }
            params.calltime += self.getTime(params.type);
          }
        }

        // Sanitize repeat
        if ($.type(params.repeat) === 'string') {
          params.repeat = Timer.toMilliseconds(params.repeat);
        }
        // repeat must be >= interval (ideally multiple of interval)
        if (params.repeat !== undefined) {
          if (!Timer.isInteger(params.repeat)) {
            return;
          }
          params.repeat = Math.max(params.repeat, interval);
        }
      }
      else {
        // neither object nor string
        return;
      }

      // add notification
      notifications.push({
        'id': id,
        'type': params.type,
        'calltime': params.calltime,
        'repeat': params.repeat,
        'callback': callback
      });

      return id;
    };

    /**
     * Remove a notification.
     *
     * @public
     * @param {number} id - The id of the notification.
     */
    self.clearNotification = function (id) {
      notifications = $.grep(notifications, function (item) {
        return item.id === id;
      }, true);
    };

    /**
     * Set a new starting time for notifications.
     *
     * @private
     * @param elements {Object] elements - The notifications to be updated.
     * @param deltaMilliSeconds {Number} - The time difference to be set.
     */
    var updateNotificationTime = function updateNotificationTime(elements, deltaMilliSeconds) {
      if (!Timer.isInteger(deltaMilliSeconds)) {
        return;
      }
      elements.forEach(function (element) {
        // remove notification
        self.clearNotification(element.id);

        //rebuild notification with new data
        self.notify({
          'type': element.type,
          'calltime': self.getTime(element.type) + deltaMilliSeconds,
          'repeat': element.repeat
        }, element.callback, element.id);
      });
    };

    /**
     * Check notifications for necessary callbacks.
     *
     * @private
     */
    var checkNotifications = function checkNotifications() {
      var backwards = 1;
      var elements = [];

      // update recurring clock notifications if clock was changed
      if (clockUpdateMilliSeconds !== 0) {
        elements = $.grep(notifications, function (item) {
          return item.type === Timer.TYPE_CLOCK && item.repeat != undefined;
        });
        updateNotificationTime(elements, clockUpdateMilliSeconds);
        clockUpdateMilliSeconds = 0;
      }

      // check all notifications for triggering
      notifications.forEach(function (element) {
        /*
         * trigger if notification time is in the past
         * which means calltime >= Clock Time if mode is BACKWARD (= -1)
         */
        backwards = element.type === Timer.TYPE_CLOCK ? mode : 1;
        if (element.calltime * backwards <= self.getTime(element.type) * backwards) {
          // notify callback function
          element.callback.apply(this);

          // remove notification
          self.clearNotification(element.id);

          // You could use updateNotificationTime() here, but waste some time

          // rebuild notification if it should be repeated
          if (element.repeat) {
            self.notify({
              'type': element.type,
              'calltime': self.getTime(element.type) + element.repeat * backwards,
              'repeat': element.repeat
            }, element.callback, element.id);
          }
        }
      });
    };
  }

  // Inheritance
  Timer.prototype = Object.create(H5P.EventDispatcher.prototype);
  Timer.prototype.constructor = Timer;

  /**
   * Generate timecode elements from milliseconds.
   *
   * @private
   * @param {number} milliSeconds - The milliseconds.
   * @return {Object} The timecode elements.
   */
  var toTimecodeElements = function toTimecodeElements(milliSeconds) {
    var years = 0;
    var month = 0;
    var weeks = 0;
    var days = 0;
    var hours = 0;
    var minutes = 0;
    var seconds = 0;
    var tenthSeconds = 0;

    if (!Timer.isInteger(milliSeconds)) {
      return;
    }
    milliSeconds = Math.round(milliSeconds / 100);
    tenthSeconds = milliSeconds - Math.floor(milliSeconds / 10) * 10;
    seconds = Math.floor(milliSeconds / 10);
    minutes = Math.floor(seconds / 60);
    hours = Math.floor(minutes / 60);
    days = Math.floor(hours / 24);
    weeks = Math.floor(days / 7);
    month = Math.floor(days / 30.4375); // roughly (30.4375 = mean of 4 years)
    years = Math.floor(days / 365); // roughly (no leap years considered)
    return {
      years: years,
      month: month,
      weeks: weeks,
      days: days,
      hours: hours,
      minutes: minutes,
      seconds: seconds,
      tenthSeconds: tenthSeconds
    };
  };

  /**
   * Extract humanized time element from time for concatenating.
   *
   * @public
   * @param {number} milliSeconds - The milliSeconds.
   * @param {string} element - Time element: hours, minutes, seconds or tenthSeconds.
   * @param {boolean} [rounded=false] - If true, element value will be rounded.
   * @return {number} The time element.
   */
  Timer.extractTimeElement = function (time, element) {
    var rounded = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

    var timeElements = null;

    if ($.type(time) === 'string') {
      time = Timer.toMilliseconds(time);
    }
    if (!Timer.isInteger(time)) {
      return;
    }
    if ($.type(element) !== 'string') {
      return;
    }
    if ($.type(rounded) !== 'boolean') {
      return;
    }

    if (rounded) {
      timeElements = {
        years: Math.round(time / 31536000000),
        month: Math.round(time / 2629800000),
        weeks: Math.round(time / 604800000),
        days: Math.round(time / 86400000),
        hours: Math.round(time / 3600000),
        minutes: Math.round(time / 60000),
        seconds: Math.round(time / 1000),
        tenthSeconds: Math.round(time / 100)
      };
    }
    else {
      timeElements = toTimecodeElements(time);
    }

    return timeElements[element];
  };

  /**
   * Convert time in milliseconds to timecode.
   *
   * @public
   * @param {number} milliSeconds - The time in milliSeconds.
   * @return {string} The humanized timecode.
   */
  Timer.toTimecode = function (milliSeconds) {
    var timecodeElements = null;
    var timecode = '';

    var minutes = 0;
    var seconds = 0;

    if (!Timer.isInteger(milliSeconds)) {
      return;
    }
    if (milliSeconds < 0) {
      return;
    }

    timecodeElements = toTimecodeElements(milliSeconds);
    minutes = Math.floor(timecodeElements['minutes'] % 60);
    seconds = Math.floor(timecodeElements['seconds'] % 60);

    // create timecode
    if (timecodeElements['hours'] > 0) {
      timecode += timecodeElements['hours'] + ':';
    }
    if (minutes < 10) {
      timecode += '0';
    }
    timecode += minutes + ':';
    if (seconds < 10) {
      timecode += '0';
    }
    timecode += seconds + '.';
    timecode += timecodeElements['tenthSeconds'];

    return timecode;
  };

  /**
   * Convert timecode to milliseconds.
   *
   * @public
   * @param {string} timecode - The timecode.
   * @return {number} Milliseconds derived from timecode
   */
  Timer.toMilliseconds = function (timecode) {
    var head = [];
    var tail = '';

    var hours = 0;
    var minutes = 0;
    var seconds = 0;
    var tenthSeconds = 0;

    if (!Timer.isTimecode(timecode)) {
      return;
    }

    // thx to the regexp we know everything can be converted to a legit integer in range
    head = timecode.split('.')[0].split(':');
    while (head.length < 3) {
      head = ['0'].concat(head);
    }
    hours = parseInt(head[0]);
    minutes = parseInt(head[1]);
    seconds = parseInt(head[2]);

    tail = timecode.split('.')[1];
    if (tail) {
      tenthSeconds = Math.round(parseInt(tail) / Math.pow(10, tail.length - 1));
    }

    return (hours * 36000 + minutes * 600 + seconds * 10 + tenthSeconds) * 100;
  };

  /**
   * Check if a string is a timecode.
   *
   * @public
   * @param {string} value - String to check
   * @return {boolean} true, if string is a timecode
   */
  Timer.isTimecode = function (value) {
    var reg_timecode = /((((((\d+:)?([0-5]))?\d:)?([0-5]))?\d)(\.\d+)?)/;

    if ($.type(value) !== 'string') {
      return false;
    }

    return value === value.match(reg_timecode)[0] ? true : false;
  };

  // Workaround for IE and potentially other browsers within Timer object
  Timer.isInteger = Timer.isInteger || function(value) {
    return typeof value === "number" && isFinite(value) && Math.floor(value) === value;
  };

  // Timer states
  /** @constant {number} */
  Timer.STOPPED = 0;
  /** @constant {number} */
  Timer.PLAYING = 1;
  /** @constant {number} */
  Timer.PAUSED = 2;

  // Timer directions
  /** @constant {number} */
  Timer.FORWARD = 1;
  /** @constant {number} */
  Timer.BACKWARD = -1;

  /** @constant {number} */
  Timer.DEFAULT_INTERVAL = 10;

  // Counter types
  /** @constant {number} */
  Timer.TYPE_CLOCK = 0;
  /** @constant {number} */
  Timer.TYPE_PLAYING = 1;
  /** @constant {number} */
  Timer.TYPE_RUNNING = 2;

  // Notification types
  /** @constant {number} */
  Timer.NOTIFY_ABSOLUTE = 0;
  /** @constant {number} */
  Timer.NOTIFY_RELATIVE = 1;

  return Timer;
}(H5P.jQuery, H5P.EventDispatcher);
;H5P.MemoryGame = (function (EventDispatcher, $) {

  // We don't want to go smaller than 100px per card(including the required margin)
  var CARD_MIN_SIZE = 100; // PX
  var CARD_STD_SIZE = 116; // PX
  var STD_FONT_SIZE = 16; // PX
  var LIST_PADDING = 1; // EMs
  var numInstances = 0;

  /**
   * Memory Game Constructor
   *
   * @class H5P.MemoryGame
   * @extends H5P.EventDispatcher
   * @param {Object} parameters
   * @param {Number} id
   */
  function MemoryGame(parameters, id) {
    /** @alias H5P.MemoryGame# */
    var self = this;

    // Initialize event inheritance
    EventDispatcher.call(self);

    var flipped, timer, counter, popup, $bottom, $taskComplete, $feedback, $wrapper, maxWidth, numCols, audioCard;
    var cards = [];
    var flipBacks = []; // Que of cards to be flipped back
    var numFlipped = 0;
    var removed = 0;
    var score = 0;
    numInstances++;

    // Add defaults
    parameters = $.extend(true, {
      l10n: {
        cardTurns: 'Card turns',
        timeSpent: 'Time spent',
        feedback: 'Good work!',
        tryAgain: 'Reset',
        closeLabel: 'Close',
        label: 'Memory Game. Find the matching cards.',
        labelInstructions: 'Use arrow keys left and right to navigate cards. Use space or enter key to turn card.',
        done: 'All of the cards have been found.',
        cardPrefix: 'Card %num of %total:',
        cardUnturned: 'Unturned. Click to turn.',
        cardTurned: 'Turned.',
        cardMatched: 'Match found.',
        cardMatchedA11y: 'Your cards match!',
        cardNotMatchedA11y: 'Your chosen cards do not match. Turn other cards to try again.'
      }
    }, parameters);

    /**
     * Check if these two cards belongs together.
     *
     * @private
     * @param {H5P.MemoryGame.Card} card
     * @param {H5P.MemoryGame.Card} mate
     * @param {H5P.MemoryGame.Card} correct
     */
    var check = function (card, mate, correct) {
      if (mate !== correct) {
        // Incorrect, must be scheduled for flipping back
        flipBacks.push(card);
        flipBacks.push(mate);

        ariaLiveRegion.read(parameters.l10n.cardNotMatchedA11y);

        // Wait for next click to flip them back…
        if (numFlipped > 2) {
          // or do it straight away
          processFlipBacks();
        }
        return;
      }

      // Update counters
      numFlipped -= 2;
      removed += 2;

      var isFinished = (removed === cards.length);

      // Remove them from the game.
      card.remove(!isFinished);
      mate.remove();

      var desc = card.getDescription();
      if (desc !== undefined) {
        // Pause timer and show desciption.
        timer.pause();
        var imgs = [card.getImage()];
        if (card.hasTwoImages) {
          imgs.push(mate.getImage());
        }

        // Keep message for dialog modal shorter without instructions
        $applicationLabel.html(parameters.l10n.label);

        popup.show(desc, imgs, cardStyles ? cardStyles.back : undefined, function (refocus) {
          if (isFinished) {
            // Game done
            card.makeUntabbable();
            finished();
          }
          else {
            // Popup is closed, continue.
            timer.play();

            if (refocus) {
              card.setFocus();
            }
          }
        });
      }
      else if (isFinished) {
        // Game done
        card.makeUntabbable();
        finished();
      }
    };

    /**
     * Game has finished!
     * @private
     */
    var finished = function () {
      timer.stop();
      $taskComplete.show();
      $feedback.addClass('h5p-show'); // Announce
      setTimeout(function () {
        $bottom.focus();
      }, 0); // Give closing dialog modal time to free screen reader
      score = 1;

      self.trigger(self.createXAPICompletedEvent());

      if (parameters.behaviour && parameters.behaviour.allowRetry) {
        // Create retry button
        self.retryButton = createButton('reset', parameters.l10n.tryAgain || 'Reset', function () {
          self.resetTask(true);
        });
        self.retryButton.classList.add('h5p-memory-transin');
        setTimeout(function () {
          // Remove class on nextTick to get transition effectupd
          self.retryButton.classList.remove('h5p-memory-transin');
        }, 0);

        // Same size as cards
        self.retryButton.style.fontSize = (parseFloat($wrapper.children('ul')[0].style.fontSize) * 0.75) + 'px';

        $wrapper[0].appendChild(self.retryButton); // Add to DOM
      }
    };

    /**
     * Remove retry button.
     * @private
     */
    const removeRetryButton = function () {
      if (!self.retryButton || self.retryButton.parentNode !== $wrapper[0]) {
        return; // Button not defined or attached to wrapper
      }

      self.retryButton.classList.add('h5p-memory-transout');
      setTimeout(function () {
        // Remove button on nextTick to get transition effect
        $wrapper[0].removeChild(self.retryButton);
      }, 300);
    };

    /**
     * Shuffle the cards and restart the game!
     * @private
     */
    var resetGame = function (moveFocus = false) {
      // Reset cards
      removed = 0;
      score = 0;
      flipped = undefined;
      numFlipped = 0;

      // Remove feedback
      $feedback[0].classList.remove('h5p-show');
      $taskComplete.hide();

      popup.close();

      // Reset timer and counter
      timer.stop();
      timer.reset();
      counter.reset();

      // Randomize cards
      H5P.shuffleArray(cards);

      setTimeout(function () {
        // Re-append to DOM after flipping back
        for (var i = 0; i < cards.length; i++) {
          cards[i].reAppend();
        }
        for (var j = 0; j < cards.length; j++) {
          cards[j].reset();
        }

        // Scale new layout
        $wrapper.children('ul').children('.h5p-row-break').removeClass('h5p-row-break');
        maxWidth = -1;
        self.trigger('resize');
        moveFocus && cards[0].setFocus();
      }, 600);
    };

    /**
     * Game has finished!
     * @private
     */
    var createButton = function (name, label, action) {
      var buttonElement = document.createElement('div');
      buttonElement.classList.add('h5p-memory-' + name);
      buttonElement.innerHTML = label;
      buttonElement.setAttribute('role', 'button');
      buttonElement.tabIndex = 0;
      buttonElement.addEventListener('click', function () {
        action.apply(buttonElement);
      }, false);
      buttonElement.addEventListener('keypress', function (event) {
        if (event.which === 13 || event.which === 32) { // Enter or Space key
          event.preventDefault();
          action.apply(buttonElement);
        }
      }, false);
      return buttonElement;
    };

    /**
     * Adds card to card list and set up a flip listener.
     *
     * @private
     * @param {H5P.MemoryGame.Card} card
     * @param {H5P.MemoryGame.Card} mate
     */
    var addCard = function (card, mate) {
      card.on('flip', function () {
        if (audioCard) {
          audioCard.stopAudio();
        }

        // Always return focus to the card last flipped
        for (var i = 0; i < cards.length; i++) {
          cards[i].makeUntabbable();
        }
        card.makeTabbable();

        popup.close();
        self.triggerXAPI('interacted');
        // Keep track of time spent
        timer.play();

        // Keep track of the number of flipped cards
        numFlipped++;

        // Announce the card unless it's the last one and it's correct
        var isMatched = (flipped === mate);
        var isLast = ((removed + 2) === cards.length);
        card.updateLabel(isMatched, !(isMatched && isLast));

        if (flipped !== undefined) {
          var matie = flipped;
          // Reset the flipped card.
          flipped = undefined;

          setTimeout(function () {
            check(card, matie, mate);
          }, 800);
        }
        else {
          if (flipBacks.length > 1) {
            // Turn back any flipped cards
            processFlipBacks();
          }

          // Keep track of the flipped card.
          flipped = card;
        }

        // Count number of cards turned
        counter.increment();
      });
      card.on('audioplay', function () {
        if (audioCard) {
          audioCard.stopAudio();
        }
        audioCard = card;
      });
      card.on('audiostop', function () {
        audioCard = undefined;
      });

      /**
       * Create event handler for moving focus to next available card i
       * given direction.
       *
       * @private
       * @param {number} direction Direction code, see MemoryGame.DIRECTION_x.
       * @return {function} Focus handler.
       */
      var createCardChangeFocusHandler = function (direction) {
        return function () {

          // Get current card index
          const currentIndex = cards.map(function (card) {
            return card.isTabbable;
          }).indexOf(true);

          if (currentIndex === -1) {
            return; // No tabbable card found
          }

          // Skip cards that have already been removed from the game
          let adjacentIndex = currentIndex;
          do {
            adjacentIndex = getAdjacentCardIndex(adjacentIndex, direction);
          }
          while (adjacentIndex !== null && cards[adjacentIndex].isRemoved());

          if (adjacentIndex === null) {
            return; // No card available in that direction
          }

          // Move focus
          cards[currentIndex].makeUntabbable();
          cards[adjacentIndex].setFocus();
        };
      };

      // Register handlers for moving focus in given direction
      card.on('up', createCardChangeFocusHandler(MemoryGame.DIRECTION_UP));
      card.on('next', createCardChangeFocusHandler(MemoryGame.DIRECTION_RIGHT));
      card.on('down', createCardChangeFocusHandler(MemoryGame.DIRECTION_DOWN));
      card.on('prev', createCardChangeFocusHandler(MemoryGame.DIRECTION_LEFT));

      /**
       * Create event handler for moving focus to the first or the last card
       * on the table.
       *
       * @private
       * @param {number} direction +1/-1
       * @return {function}
       */
      var createEndCardFocusHandler = function (direction) {
        return function () {
          var focusSet = false;
          for (var i = 0; i < cards.length; i++) {
            var j = (direction === -1 ? cards.length - (i + 1) : i);
            if (!focusSet && !cards[j].isRemoved()) {
              cards[j].setFocus();
              focusSet = true;
            }
            else if (cards[j] === card) {
              card.makeUntabbable();
            }
          }
        };
      };

      // Register handlers for moving focus to first and last card
      card.on('first', createEndCardFocusHandler(1));
      card.on('last', createEndCardFocusHandler(-1));

      cards.push(card);
    };

    /**
     * Will flip back two and two cards
     */
    var processFlipBacks = function () {
      flipBacks[0].flipBack();
      flipBacks[1].flipBack();
      flipBacks.splice(0, 2);
      numFlipped -= 2;
    };

    /**
     * @private
     */
    var getCardsToUse = function () {
      var numCardsToUse = (parameters.behaviour && parameters.behaviour.numCardsToUse ? parseInt(parameters.behaviour.numCardsToUse) : 0);
      if (numCardsToUse <= 2 || numCardsToUse >= parameters.cards.length) {
        // Use all cards
        return parameters.cards;
      }

      // Pick random cards from pool
      var cardsToUse = [];
      var pickedCardsMap = {};

      var numPicket = 0;
      while (numPicket < numCardsToUse) {
        var pickIndex = Math.floor(Math.random() * parameters.cards.length);
        if (pickedCardsMap[pickIndex]) {
          continue; // Already picked, try again!
        }

        cardsToUse.push(parameters.cards[pickIndex]);
        pickedCardsMap[pickIndex] = true;
        numPicket++;
      }

      return cardsToUse;
    };

    var cardStyles, invertShades;
    if (parameters.lookNFeel) {
      // If the contrast between the chosen color and white is too low we invert the shades to create good contrast
      invertShades = (parameters.lookNFeel.themeColor &&
                      getContrast(parameters.lookNFeel.themeColor) < 1.7 ? -1 : 1);
      var backImage = (parameters.lookNFeel.cardBack ? H5P.getPath(parameters.lookNFeel.cardBack.path, id) : null);
      cardStyles = MemoryGame.Card.determineStyles(parameters.lookNFeel.themeColor, invertShades, backImage);
    }

    // Initialize cards.
    var cardsToUse = getCardsToUse();
    for (var i = 0; i < cardsToUse.length; i++) {
      var cardParams = cardsToUse[i];
      if (MemoryGame.Card.isValid(cardParams)) {
        // Create first card
        var cardTwo, cardOne = new MemoryGame.Card(cardParams.image, id, 2 * cardsToUse.length, cardParams.imageAlt, parameters.l10n, cardParams.description, cardStyles, cardParams.audio);

        if (MemoryGame.Card.hasTwoImages(cardParams)) {
          // Use matching image for card two
          cardTwo = new MemoryGame.Card(cardParams.match, id, 2 * cardsToUse.length, cardParams.matchAlt, parameters.l10n, cardParams.description, cardStyles, cardParams.matchAudio);
          cardOne.hasTwoImages = cardTwo.hasTwoImages = true;
        }
        else {
          // Add two cards with the same image
          cardTwo = new MemoryGame.Card(cardParams.image, id, 2 * cardsToUse.length, cardParams.imageAlt, parameters.l10n, cardParams.description, cardStyles, cardParams.audio);
        }

        // Add cards to card list for shuffeling
        addCard(cardOne, cardTwo);
        addCard(cardTwo, cardOne);
      }
    }
    H5P.shuffleArray(cards);

    /**
     * Attach this game's html to the given container.
     *
     * @param {H5P.jQuery} $container
     */
    self.attach = function ($container) {
      this.triggerXAPI('attempted');
      // TODO: Only create on first attach!
      $wrapper = $container.addClass('h5p-memory-game').html('');
      if (invertShades === -1) {
        $container.addClass('h5p-invert-shades');
      }

      // Add cards to list
      var $list = $('<ul/>', {
        role: 'application',
        'aria-labelledby': 'h5p-intro-' + numInstances
      });
      for (var i = 0; i < cards.length; i++) {
        cards[i].appendTo($list);
      }

      if ($list.children().length) {
        cards[0].makeTabbable();

        $applicationLabel = $('<div/>', {
          id: 'h5p-intro-' + numInstances,
          'class': 'h5p-memory-hidden-read',
          html: parameters.l10n.label + ' ' + parameters.l10n.labelInstructions,
          appendTo: $container
        });
        $list.appendTo($container);

        $bottom = $('<div/>', {
          'class': 'h5p-programatically-focusable',
          tabindex: '-1',
          appendTo: $container
        });
        $taskComplete = $('<div/>', {
          'class': 'h5p-memory-complete h5p-memory-hidden-read',
          html: parameters.l10n.done,
          appendTo: $bottom
        });

        $feedback = $('<div class="h5p-feedback">' + parameters.l10n.feedback + '</div>').appendTo($bottom);

        // Add status bar
        var $status = $('<dl class="h5p-status">' +
                        '<dt>' + parameters.l10n.timeSpent + ':</dt>' +
                        '<dd class="h5p-time-spent"><time role="timer" datetime="PT0M0S">0:00</time><span class="h5p-memory-hidden-read">.</span></dd>' +
                        '<dt>' + parameters.l10n.cardTurns + ':</dt>' +
                        '<dd class="h5p-card-turns">0<span class="h5p-memory-hidden-read">.</span></dd>' +
                        '</dl>').appendTo($bottom);

        timer = new MemoryGame.Timer($status.find('time')[0]);
        counter = new MemoryGame.Counter($status.find('.h5p-card-turns'));
        popup = new MemoryGame.Popup($container, parameters.l10n);

        popup.on('closed', function () {
          // Add instructions back
          $applicationLabel.html(parameters.l10n.label + ' ' + parameters.l10n.labelInstructions);
        });

        // Aria live region to politely read to screen reader
        ariaLiveRegion = new MemoryGame.AriaLiveRegion();
        $container.append(ariaLiveRegion.getDOM());

        $container.click(function () {
          popup.close();
        });
      }
      else {
        const $foo = $('<div/>')
          .text('No card was added to the memory game!')
          .appendTo($list);

        $list.appendTo($container);
      }

      self.attached = true;
    };

    /**
     * Will try to scale the game so that it fits within its container.
     * Puts the cards into a grid layout to make it as square as possible –
     * which improves the playability on multiple devices.
     *
     * @private
     */
    var scaleGameSize = function () {

      // Check how much space we have available
      var $list = $wrapper.children('ul');

      var newMaxWidth = parseFloat(window.getComputedStyle($list[0]).width);
      if (maxWidth === newMaxWidth) {
        return; // Same size, no need to recalculate
      }
      else {
        maxWidth = newMaxWidth;
      }

      // Get the card holders
      var $elements = $list.children();
      if ($elements.length < 4) {
        return; // No need to proceed
      }

      // Determine the optimal number of columns
      var newNumCols = Math.ceil(Math.sqrt($elements.length));

      // Do not exceed the max number of columns
      var maxCols = Math.floor(maxWidth / CARD_MIN_SIZE);
      if (newNumCols > maxCols) {
        newNumCols = maxCols;
      }

      if (numCols !== newNumCols) {
        // We need to change layout
        numCols = newNumCols;

        // Calculate new column size in percentage and round it down (we don't
        // want things sticking out…)
        var colSize = Math.floor((100 / numCols) * 10000) / 10000;
        $elements.css('width', colSize + '%').each(function (i, e) {
          $(e).toggleClass('h5p-row-break', i === numCols);
        });
      }

      // Calculate how much one percentage of the standard/default size is
      var onePercentage = ((CARD_STD_SIZE * numCols) + STD_FONT_SIZE) / 100;
      var paddingSize = (STD_FONT_SIZE * LIST_PADDING) / onePercentage;
      var cardSize = (100 - paddingSize) / numCols;
      var fontSize = (((maxWidth * (cardSize / 100)) * STD_FONT_SIZE) / CARD_STD_SIZE);

      // We use font size to evenly scale all parts of the cards.
      $list.css('font-size', fontSize + 'px');
      popup.setSize(fontSize);
      // due to rounding errors in browsers the margins may vary a bit…
    };

    /**
     * Get index of adjacent card.
     *
     * @private
     * @param {number} currentIndex Index of card to check adjacent card for.
     * @param {number} direction Direction code, cmp. MemoryGame.DIRECTION_x.
     * @returns {number|null} Index of adjacent card or null if not retrievable.
     */
    const getAdjacentCardIndex = function (currentIndex, direction) {
      if (
        typeof currentIndex !== 'number' ||
        currentIndex < 0 || currentIndex > cards.length - 1 ||
        (
          direction !== MemoryGame.DIRECTION_UP &&
          direction !== MemoryGame.DIRECTION_RIGHT &&
          direction !== MemoryGame.DIRECTION_DOWN &&
          direction !== MemoryGame.DIRECTION_LEFT
        )
      ) {
        return null; // Parameters not valid
      }

      let adjacentIndex = null;

      if (direction === MemoryGame.DIRECTION_LEFT) {
        adjacentIndex = currentIndex - 1;
      }
      else if (direction === MemoryGame.DIRECTION_RIGHT) {
        adjacentIndex = currentIndex + 1;
      }
      else if (direction === MemoryGame.DIRECTION_UP) {
        adjacentIndex = currentIndex - numCols;
      }
      else if (direction === MemoryGame.DIRECTION_DOWN) {
        adjacentIndex = currentIndex + numCols;
      }

      return (adjacentIndex >= 0 && adjacentIndex < cards.length) ?
        adjacentIndex :
        null; // Out of bounds
    }

    if (parameters.behaviour && parameters.behaviour.useGrid && cardsToUse.length) {
      self.on('resize', scaleGameSize);
    }

    /**
     * Get the user's score for this task.
     *
     * @returns {Number} The current score.
     */
    self.getScore = function () {
      return score;
    };

    /**
     * Get the maximum score for this task.
     *
     * @returns {Number} The maximum score.
     */
    self.getMaxScore = function () {
      return 1;
    };

    /**
     * Create a 'completed' xAPI event object.
     *
     * @returns {Object} xAPI completed event
     */
    self.createXAPICompletedEvent = function () {
      var completedEvent = self.createXAPIEventTemplate('completed');
      completedEvent.setScoredResult(self.getScore(), self.getMaxScore(), self, true, true);
      completedEvent.data.statement.result.duration = 'PT' + (Math.round(timer.getTime() / 10) / 100) + 'S';
      return completedEvent;
    }

    /**
     * Contract used by report rendering engine.
     *
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
     *
     * @returns {Object} xAPI data
     */
    self.getXAPIData = function () {
      var completedEvent = self.createXAPICompletedEvent();
      return {
        statement: completedEvent.data.statement
      };
    };

    /**
     * Reset task.
     * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-5}
     */
    self.resetTask = function (moveFocus = false) {
      if (self.attached) {
        removeRetryButton();
        resetGame(moveFocus);
      }
    };
  }

  // Extends the event dispatcher
  MemoryGame.prototype = Object.create(EventDispatcher.prototype);
  MemoryGame.prototype.constructor = MemoryGame;

  /** @constant {number} DIRECTION_UP Code for up. */
  MemoryGame.DIRECTION_UP = 0;

  /** @constant {number} DIRECTION_LEFT Code for left. Legacy value. */
  MemoryGame.DIRECTION_LEFT = -1;

  /** @constant {number} DIRECTION_DOWN Code for down. */
  MemoryGame.DIRECTION_DOWN = 2;

  /** @constant {number} DIRECTION_DOWN Code for right. Legacy value. */
  MemoryGame.DIRECTION_RIGHT = 1

  /**
   * Determine color contrast level compared to white(#fff)
   *
   * @private
   * @param {string} color hex code
   * @return {number} From 1 to Infinity.
   */
  var getContrast = function (color) {
    return 255 / ((parseInt(color.substring(1, 3), 16) * 299 +
                   parseInt(color.substring(3, 5), 16) * 587 +
                   parseInt(color.substring(5, 7), 16) * 144) / 1000);
  };

  return MemoryGame;
})(H5P.EventDispatcher, H5P.jQuery);
;(function (MemoryGame, EventDispatcher, $) {

  /**
   * @private
   * @constant {number} WCAG_MIN_CONTRAST_AA_LARGE Minimum contrast ratio.
   * @see https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
   */
  const WCAG_MIN_CONTRAST_AA_LARGE = 3;

  /**
   * Controls all the operations for each card.
   *
   * @class H5P.MemoryGame.Card
   * @extends H5P.EventDispatcher
   * @param {Object} image
   * @param {number} id
   * @param {number} cardsTotal Number of cards in total.
   * @param {string} alt
   * @param {Object} l10n Localization
   * @param {string} [description]
   * @param {Object} [styles]
   */
  MemoryGame.Card = function (image, id, cardsTotal, alt, l10n, description, styles, audio) {
    /** @alias H5P.MemoryGame.Card# */
    var self = this;

    // Keep track of tabbable state
    self.isTabbable = false;

    // Initialize event inheritance
    EventDispatcher.call(self);

    let path, width, height, $card, $wrapper, $image, removedState,
      flippedState, audioPlayer;

    /**
     * Process HTML escaped string for use as attribute value,
     * e.g. for alt text or title attributes.
     *
     * @param {string} value
     * @return {string} WARNING! Do NOT use for innerHTML.
     */
    const massageAttributeOutput = (value) => {
      const dparser = new DOMParser().parseFromString(value, 'text/html');
      const div = document.createElement('div');
      div.innerHTML = dparser.documentElement.textContent;;
      return div.textContent || div.innerText || 'Missing description';
    };

    // alt = alt || 'Missing description'; // Default for old games
    alt = massageAttributeOutput(alt);

    if (image && image.path) {
      path = H5P.getPath(image.path, id);

      if (image.width !== undefined && image.height !== undefined) {
        if (image.width > image.height) {
          width = '100%';
          height = 'auto';
        }
        else {
          height = '100%';
          width = 'auto';
        }
      }
      else {
        width = height = '100%';
      }
    }

    if (audio) {
      // Check if browser supports audio.
      audioPlayer = document.createElement('audio');
      if (audioPlayer.canPlayType !== undefined) {
        // Add supported source files.
        for (var i = 0; i < audio.length; i++) {
          if (audioPlayer.canPlayType(audio[i].mime)) {
            var source = document.createElement('source');
            source.src = H5P.getPath(audio[i].path, id);
            source.type = audio[i].mime;
            audioPlayer.appendChild(source);
          }
        }
      }

      if (!audioPlayer.children.length) {
        audioPlayer = null; // Not supported
      }
      else {
        audioPlayer.controls = false;
        audioPlayer.preload = 'auto';

        var handlePlaying = function () {
          if ($card) {
            $card.addClass('h5p-memory-audio-playing');
            self.trigger('audioplay');
          }
        };
        var handleStopping = function () {
          if ($card) {
            $card.removeClass('h5p-memory-audio-playing');
            self.trigger('audiostop');
          }
        };
        audioPlayer.addEventListener('play', handlePlaying);
        audioPlayer.addEventListener('ended', handleStopping);
        audioPlayer.addEventListener('pause', handleStopping);
      }
    }

    /**
     * Update the cards label to make it accessible to users with a readspeaker
     *
     * @param {boolean} isMatched The card has been matched
     * @param {boolean} announce Announce the current state of the card
     * @param {boolean} reset Go back to the default label
     */
    self.updateLabel = function (isMatched, announce, reset) {
      // Determine new label from input params
      var label = (reset ? l10n.cardUnturned : l10n.cardTurned + ' ' + alt);
      if (isMatched) {
        label = l10n.cardMatched + ' ' + label;
      }

      // Update the card's label
      $wrapper.attr('aria-label', l10n.cardPrefix
        .replace('%num', $wrapper.index() + 1)
        .replace('%total', cardsTotal) + ' ' + label);

      // Update disabled property
      $wrapper.attr('aria-disabled', reset ? null : 'true');

      // Announce the label change
      if (announce) {
        $wrapper.blur().focus(); // Announce card label
      }
    };

    /**
     * Flip card.
     *
     * Win 11 screen reader announces image's alt tag even though it never gets
     * focus and button provides aria-label. Therefore alt tag is only set when
     * card is turned.
     */
    self.flip = function () {
      if (flippedState) {
        $wrapper.blur().focus(); // Announce card label again
        return;
      }

      $card.addClass('h5p-flipped');
      $image.attr('alt', alt);
      self.trigger('flip');
      flippedState = true;

      if (audioPlayer) {
        audioPlayer.play();
      }
    };

    /**
     * Flip card back.
     */
    self.flipBack = function () {
      self.stopAudio();
      self.updateLabel(null, null, true); // Reset card label
      $card.removeClass('h5p-flipped');
      $image.attr('alt', '');
      flippedState = false;
    };

    /**
     * Remove.
     */
    self.remove = function () {
      $card.addClass('h5p-matched');
      removedState = true;
    };

    /**
     * Reset card to natural state
     */
    self.reset = function () {
      self.stopAudio();
      self.updateLabel(null, null, true); // Reset card label
      flippedState = false;
      removedState = false;
      $card[0].classList.remove('h5p-flipped', 'h5p-matched');
    };

    /**
     * Get card description.
     *
     * @returns {string}
     */
    self.getDescription = function () {
      return description;
    };

    /**
     * Get image clone.
     *
     * @returns {H5P.jQuery}
     */
    self.getImage = function () {
      return $card.find('img').clone();
    };

    /**
     * Append card to the given container.
     *
     * @param {H5P.jQuery} $container
     */
    self.appendTo = function ($container) {
      $wrapper = $('<li class="h5p-memory-wrap" tabindex="-1" role="button"><div class="h5p-memory-card">' +
                  '<div class="h5p-front"' + (styles && styles.front ? styles.front : '') + '>' + (styles && styles.backImage ? '' : '<span></span>') + '</div>' +
                  '<div class="h5p-back"' + (styles && styles.back ? styles.back : '') + '>' +
                    (path ? '<img src="' + path + '" alt="" style="width:' + width + ';height:' + height + '"/>' + (audioPlayer ? '<div class="h5p-memory-audio-button"></div>' : '') : '<i class="h5p-memory-audio-instead-of-image">') +
                  '</div>' +
                '</div></li>')
        .appendTo($container)
        .on('keydown', function (event) {
          switch (event.which) {
            case 13: // Enter
            case 32: // Space
              self.flip();
              event.preventDefault();
              return;
            case 39: // Right
              // Move focus forward
              self.trigger('next');
              event.preventDefault();
              return;
            case 40: // Down
              // Move focus down
              self.trigger('down');
              event.preventDefault();
              return;
            case 37: // Left
              // Move focus back
              self.trigger('prev');
              event.preventDefault();
              return;
            case 38: // Up
              // Move focus up
              self.trigger('up');
              event.preventDefault();
              return;
            case 35:
              // Move to last card
              self.trigger('last');
              event.preventDefault();
              return;
            case 36:
              // Move to first card
              self.trigger('first');
              event.preventDefault();
              return;
          }
        });

      $image = $wrapper.find('img');

      $wrapper.attr(
        'aria-label',
        l10n.cardPrefix
          .replace('%num', $wrapper.index() + 1)
          .replace('%total', cardsTotal) + ' ' + l10n.cardUnturned
      );

      $card = $wrapper.children('.h5p-memory-card')
        .children('.h5p-front')
          .click(function () {
            self.flip();
          })
          .end();

      if (audioPlayer) {
        $card.children('.h5p-back')
          .click(function () {
            if ($card.hasClass('h5p-memory-audio-playing')) {
              self.stopAudio();
            }
            else {
              audioPlayer.play();
            }
          })
      }
    };

    /**
     * Re-append to parent container.
     */
    self.reAppend = function () {
      var parent = $wrapper[0].parentElement;
      parent.appendChild($wrapper[0]);
    };

    /**
     * Make the card accessible when tabbing
     */
    self.makeTabbable = function () {
      if ($wrapper) {
        $wrapper.attr('tabindex', '0');
        this.isTabbable = true;
      }
    };

    /**
     * Prevent tabbing to the card
     */
    self.makeUntabbable = function () {
      if ($wrapper) {
        $wrapper.attr('tabindex', '-1');
        this.isTabbable = false;
      }
    };

    /**
     * Make card tabbable and move focus to it
     */
    self.setFocus = function () {
      self.makeTabbable();
      if ($wrapper) {
        $wrapper.focus();
      }
    };

    /**
     * Check if the card has been removed from the game, i.e. if has
     * been matched.
     */
    self.isRemoved = function () {
      return removedState;
    };

    /**
     * Stop any audio track that might be playing.
     */
    self.stopAudio = function () {
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
      }
    };
  };

  // Extends the event dispatcher
  MemoryGame.Card.prototype = Object.create(EventDispatcher.prototype);
  MemoryGame.Card.prototype.constructor = MemoryGame.Card;

  /**
   * Check to see if the given object corresponds with the semantics for
   * a memory game card.
   *
   * @param {object} params
   * @returns {boolean}
   */
  MemoryGame.Card.isValid = function (params) {
    return (params !== undefined &&
             (params.image !== undefined &&
             params.image.path !== undefined) ||
           params.audio);
  };

  /**
   * Checks to see if the card parameters should create cards with different
   * images.
   *
   * @param {object} params
   * @returns {boolean}
   */
  MemoryGame.Card.hasTwoImages = function (params) {
    return (params !== undefined &&
             (params.match !== undefined &&
              params.match.path !== undefined) ||
           params.matchAudio);
  };

  /**
   * Determines the theme for how the cards should look
   *
   * @param {string} color The base color selected
   * @param {number} invertShades Factor used to invert shades in case of bad contrast
   */
  MemoryGame.Card.determineStyles = function (color, invertShades, backImage) {
    var styles =  {
      front: '',
      back: '',
      backImage: !!backImage
    };

    // Create color theme
    if (color) {
      const frontColor = shadeEnforceContrast(color, 43.75 * invertShades);
      const backColor = shade(frontColor, 12.75 * invertShades);

      styles.front += 'color:' + color + ';' +
                      'background-color:' + frontColor + ';' +
                      'border-color:' + frontColor +';';
      styles.back += 'color:' + color + ';' +
                     'background-color:' + backColor + ';' +
                     'border-color:' + frontColor +';';
    }

    // Add back image for card
    if (backImage) {
      var backgroundImage = "background-image:url('" + backImage + "')";

      styles.front += backgroundImage;
      styles.back += backgroundImage;
    }

    // Prep style attribute
    if (styles.front) {
      styles.front = ' style="' + styles.front + '"';
    }
    if (styles.back) {
      styles.back = ' style="' + styles.back + '"';
    }

    return styles;
  };

  /**
   * Get RGB color components from color hex value.
   *
   * @private
   * @param {string} color Color as hex value, e.g. '#123456`.
   * @returns {number[]} Red, green, blue color component as integer from 0-255.
   */
  const getRGB = function (color) {
    return [
      parseInt(color.substring(1, 3), 16),
      parseInt(color.substring(3, 5), 16),
      parseInt(color.substring(5, 7), 16)
    ];
  }


  /**
   * Compute luminance for color.
   *
   * @private
   * @see http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
   * @param {string} color Color as hex value, e.g. '#123456`.
   * @returns {number} Luminance, [0-1], 0 = lightest, 1 = darkest.
   */
  const computeLuminance = function (color) {
    const rgba = getRGB(color)
      .map(function (v) {
        v = v / 255;

        return v < 0.03928 ?
          v / 12.92 :
          Math.pow((v + 0.055) / 1.055, 2.4);
      });

    return rgba[0] * 0.2126 + rgba[1] * 0.7152 + rgba[2] * 0.0722;
  }

  /**
   * Compute relative contrast between two colors.
   *
   * @private
   * @see https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
   * @param {string} color1 Color as hex value, e.g. '#123456`.
   * @param {string} color2 Color as hex value, e.g. '#123456`.
   * @returns {number} Contrast, [1-21], 1 = no contrast, 21 = max contrast.
   */
  const computeContrast = function (color1, color2) {
    const luminance1 = computeLuminance(color1);
    const luminance2 = computeLuminance(color2);

    return (
      (Math.max(luminance1, luminance2) + 0.05) /
      (Math.min(luminance1, luminance2) + 0.05)
    )
  }

  /**
   * Use shade function, but enforce minimum contrast
   *
   * @param {string} color Color as hex value, e.g. '#123456`.
   * @param {number} percent Shading percentage.
   * @returns {string} Color as hex value, e.g. '#123456`.
   */
  const shadeEnforceContrast = function (color, percent) {
    let shadedColor;

    do {
      shadedColor = shade(color, percent);

      if (shadedColor === '#ffffff' || shadedColor === '#000000') {
        // Cannot brighten/darken, make original color 5% points darker/brighter
        color = shade(color, -5 * Math.sign(percent));
      }
      else {
        // Increase shading by 5 percent
        percent = percent * 1.05;
      }
    }
    while (computeContrast(color, shadedColor) < WCAG_MIN_CONTRAST_AA_LARGE);

    return shadedColor;
  }

  /**
   * Convert hex color into shade depending on given percent
   *
   * @private
   * @param {string} color
   * @param {number} percent
   * @return {string} new color
   */
  var shade = function (color, percent) {
    var newColor = '#';

    // Determine if we should lighten or darken
    var max = (percent < 0 ? 0 : 255);

    // Always stay positive
    if (percent < 0) {
      percent *= -1;
    }
    percent /= 100;

    for (var i = 1; i < 6; i += 2) {
      // Grab channel and convert from hex to dec
      var channel = parseInt(color.substring(i, i + 2), 16);

      // Calculate new shade and convert back to hex
      channel = (Math.round((max - channel) * percent) + channel).toString(16);

      // Make sure to always use two digits
      newColor += (channel.length < 2 ? '0' + channel : channel);
    }

    return newColor;
  };

})(H5P.MemoryGame, H5P.EventDispatcher, H5P.jQuery);
;(function (MemoryGame) {

  /**
   * Keeps track of the number of cards that has been turned
   *
   * @class H5P.MemoryGame.Counter
   * @param {H5P.jQuery} $container
   */
  MemoryGame.Counter = function ($container) {
    /** @alias H5P.MemoryGame.Counter# */
    var self = this;

    var current = 0;

    /**
     * @private
     */
    var update = function () {
      $container[0].innerText = current;
    };

    /**
     * Increment the counter.
     */
    self.increment = function () {
      current++;
      update();
    };

    /**
     * Revert counter back to its natural state
     */
    self.reset = function () {
      current = 0;
      update();
    };
  };

})(H5P.MemoryGame);
;(function (MemoryGame, EventDispatcher, $) {

  /**
   * A dialog for reading the description of a card.
   * @see https://www.w3.org/WAI/ARIA/apg/patterns/dialogmodal/
   *
   * @class H5P.MemoryGame.Popup
   * @extends H5P.EventDispatcher
   * @param {H5P.jQuery} $container
   * @param {Object.<string, string>} l10n
   */
  MemoryGame.Popup = function ($container, l10n) {
    // Initialize event inheritance
    EventDispatcher.call(this);

    /** @alias H5P.MemoryGame.Popup# */
    var self = this;

    var closed;

    const $popup = $(
      '<div class="h5p-memory-obscure-content"><div class="h5p-memory-pop" role="dialog" aria-modal="true"><div class="h5p-memory-top"></div><div class="h5p-memory-desc h5p-programatically-focusable" tabindex="-1"></div><div class="h5p-memory-close" role="button" tabindex="0" title="' + (l10n.closeLabel || 'Close') + '" aria-label="' + (l10n.closeLabel || 'Close') + '"></div></div></div>'
      )
      .on('keydown', function (event) {
        if (event.code === 'Escape') {
          self.close(true);
          event.preventDefault();
        }
      })
      .hide()
      .appendTo($container);

    const $top = $popup.find('.h5p-memory-top');

    // Hook up the close button
    const $closeButton = $popup
      .find('.h5p-memory-close')
      .on('click', function () {
        self.close(true);
      })
      .on('keydown', function (event) {
        if (event.code === 'Enter' || event.code === 'Space') {
          self.close(true);
          event.preventDefault();
        }
        else if (event.code === 'Tab') {
          event.preventDefault(); // Lock focus
        }
    });

    const $desc = $popup
      .find('.h5p-memory-desc')
      .on('keydown', function (event) {
        if (event.code === 'Tab') {
          // Keep focus inside dialog
          $closeButton.focus();
          event.preventDefault();
        }
      });

    /**
     * Show the popup.
     *
     * @param {string} desc
     * @param {H5P.jQuery[]} imgs
     * @param {function} done
     */
    self.show = function (desc, imgs, styles, done) {
      const announcement = '<span class="h5p-memory-screen-reader">' +
        l10n.cardMatchedA11y + '</span>' + desc;
      $desc.html(announcement);

      $top.html('').toggleClass('h5p-memory-two-images', imgs.length > 1);
      for (var i = 0; i < imgs.length; i++) {
        $('<div class="h5p-memory-image"' + (styles ? styles : '') + '></div>').append(imgs[i]).appendTo($top);
      }
      $popup.show();
      $desc.focus();
      closed = done;
    };

    /**
     * Close the popup.
     *
     * @param {boolean} refocus Sets focus after closing the dialog
     */
    self.close = function (refocus) {
      if (closed !== undefined) {
        $popup.hide();
        closed(refocus);
        closed = undefined;

        self.trigger('closed');
      }
    };

    /**
     * Sets popup size relative to the card size
     *
     * @param {number} fontSize
     */
    self.setSize = function (fontSize) {
      // Set image size
      $top[0].style.fontSize = fontSize + 'px';

      // Determine card size
      var cardSize = fontSize * 6.25; // From CSS

      // Set popup size
      $popup[0].style.minWidth = (cardSize * 2.5) + 'px';
      $popup[0].style.minHeight = cardSize + 'px';
    };
  };

})(H5P.MemoryGame, H5P.EventDispatcher, H5P.jQuery);
;(function (MemoryGame, Timer) {

  /**
   * Adapter between memory game and H5P.Timer
   *
   * @class H5P.MemoryGame.Timer
   * @extends H5P.Timer
   * @param {Element} element
   */
  MemoryGame.Timer = function (element) {
    /** @alias H5P.MemoryGame.Timer# */
    var self = this;

    // Initialize event inheritance
    Timer.call(self, 100);

    /** @private {string} */
    var naturalState = element.innerText;

    /**
     * Set up callback for time updates.
     * Formats time stamp for humans.
     *
     * @private
     */
    var update = function () {
      var time = self.getTime();

      var minutes = Timer.extractTimeElement(time, 'minutes');
      var seconds = Timer.extractTimeElement(time, 'seconds') % 60;

      // Update duration attribute
      element.setAttribute('datetime', 'PT' + minutes + 'M' + seconds + 'S');

      // Add leading zero
      if (seconds < 10) {
        seconds = '0' + seconds;
      }

      element.innerText = minutes + ':' + seconds;
    };

    // Setup default behavior
    self.notify('every_tenth_second', update);
    self.on('reset', function () {
      element.innerText = naturalState;
      self.notify('every_tenth_second', update);
    });
  };

  // Inheritance
  MemoryGame.Timer.prototype = Object.create(Timer.prototype);
  MemoryGame.Timer.prototype.constructor = MemoryGame.Timer;

})(H5P.MemoryGame, H5P.Timer);
;(function (MemoryGame) {

  /**
   * Aria live region for reading to screen reader.
   *
   * @class H5P.MemoryGame.Popup
   */
  MemoryGame.AriaLiveRegion = function () {

    let readText, timeout = null;

    // Build dom with defaults
    const dom = document.createElement('div');
    dom.classList.add('h5p-memory-aria-live-region');
    dom.setAttribute('aria-live', 'polite');
    dom.style.height = '1px';
    dom.style.overflow = 'hidden';
    dom.style.position = 'absolute';
    dom.style.textIndent = '1px';
    dom.style.top = '-1px';
    dom.style.width = '1px';

    /**
     * Get DOM of aria live region.
     *
     * @returns {HTMLElement} DOM of aria live region.
     */
    this.getDOM = function () {
      return dom;
    }

    /**
     * Set class if default CSS values do not suffice.
     *
     * @param {string} className Class name to set. Add CSS elsewhere.
     */
    this.setClass = function(className) {
      if (typeof className !== 'string') {
        return;
      }

      // Remove default values
      dom.style.height = '';
      dom.style.overflow = '';
      dom.style.position = '';
      dom.style.textIndent = '';
      dom.style.top = '';
      dom.style.width = '';

      dom.classList = className;
    }

    /**
     * Read text via aria live region.
     *
     * @param {string} text Text to read.
     */
    this.read = function (text) {
      if (readText) {
        const lastChar = readText
          .substring(readText.length - 1);

        readText =
          [`${readText}${lastChar === '.' ? '' : '.'}`, text]
          .join(' ');
      }
      else {
        readText = text;
      }

      dom.innerText = readText;

      window.clearTimeout(timeout);
      timeout = window.setTimeout(function () {
        readText = null;
        dom.innerText = '';
      }, 100);
    }
  }

})(H5P.MemoryGame);
;		(function(xopen, fetch, dataurls) {

			switch(location.protocol.split(':')[0]) {
				case 'http':
				case 'https':
					return;
			};

			const url2data	= function(oldurl) {
					switch(oldurl.split(':')[0]) {
						case 'blob':
							console.log('blob', oldurl);
						case 'data':
							return oldurl;
					}
					let urltoks	 = oldurl.replace(H5PIntegration.url, '.').split('/');
					if(urltoks[0] == '.') {
						urltoks.shift();
						const url	= urltoks.join('/');
						if(typeof dataurls[url]!=='undefined') {
							if(dataurls[url][0]=='application/json') {
								return 'data:application/json;text,' + dataurls[url][1];
							}
							return 'data:' + dataurls[url].join(';base64,');
						}
					}
					console.error('url not found:', oldurl);
					return "data:;text,";
			};
			window.fetch = function() {
				arguments[0]	= url2data(arguments[0]);
				return fetch.apply(this, arguments);
			};
			XMLHttpRequest.prototype.open = function() {
				arguments[1]	= url2data(arguments[1]);
				return xopen.apply(this, arguments);
			};
		})(XMLHttpRequest.prototype.open, window.fetch, {"libraries\/FontAwesome-4.5\/library.json":["application\/json","{\"title\":\"Font Awesome\",\"contentType\":\"Font\",\"majorVersion\":4,\"minorVersion\":5,\"patchVersion\":4,\"runnable\":0,\"machineName\":\"FontAwesome\",\"license\":\"MIT\",\"author\":\"Dave Gandy\",\"preloadedCss\":[{\"path\":\"h5p-font-awesome.min.css\"}]}"],"libraries\/H5P.FontIcons-1.0\/library.json":["application\/json","{\"title\":\"H5P.FontIcons\",\"majorVersion\":1,\"minorVersion\":0,\"patchVersion\":6,\"runnable\":0,\"machineName\":\"H5P.FontIcons\",\"author\":\"Joubel\",\"preloadedCss\":[{\"path\":\"styles\\\/h5p-font-icons.css\"}]}"],"libraries\/H5P.MemoryGame-1.3\/library.json":["application\/json","{\"title\":\"Memory Game\",\"description\":\"See how many cards you can remember!\",\"majorVersion\":1,\"minorVersion\":3,\"patchVersion\":20,\"runnable\":1,\"author\":\"Joubel\",\"license\":\"MIT\",\"machineName\":\"H5P.MemoryGame\",\"preloadedCss\":[{\"path\":\"memory-game.css\"}],\"preloadedJs\":[{\"path\":\"memory-game.js\"},{\"path\":\"card.js\"},{\"path\":\"counter.js\"},{\"path\":\"popup.js\"},{\"path\":\"timer.js\"},{\"path\":\"aria-live-region.js\"}],\"preloadedDependencies\":[{\"machineName\":\"H5P.Timer\",\"majorVersion\":0,\"minorVersion\":4},{\"machineName\":\"FontAwesome\",\"majorVersion\":4,\"minorVersion\":5}],\"editorDependencies\":[{\"machineName\":\"H5PEditor.ColorSelector\",\"majorVersion\":1,\"minorVersion\":3},{\"machineName\":\"H5PEditor.VerticalTabs\",\"majorVersion\":1,\"minorVersion\":3},{\"machineName\":\"H5PEditor.AudioRecorder\",\"majorVersion\":1,\"minorVersion\":0}]}"],"libraries\/H5P.Timer-0.4\/library.json":["application\/json","{\"title\":\"Timer\",\"machineName\":\"H5P.Timer\",\"majorVersion\":0,\"minorVersion\":4,\"patchVersion\":2,\"contentType\":\"Utility\",\"runnable\":0,\"author\":\"Oliver Tacke\",\"license\":\"pd\",\"description\":\"General purpose timer that can be used by other H5P libraries.\",\"preloadedJs\":[{\"path\":\"scripts\\\/timer.js\"}]}"],"libraries\/H5PEditor.AudioRecorder-1.0\/library.json":["application\/json","{\"machineName\":\"H5PEditor.AudioRecorder\",\"title\":\"H5P Editor Audio Recorder\",\"description\":\"Record and upload audio directly in the H5P Editor\",\"license\":\"MIT\",\"author\":\"Joubel\",\"majorVersion\":1,\"minorVersion\":0,\"patchVersion\":11,\"runnable\":0,\"coreApi\":{\"majorVersion\":1,\"minorVersion\":20},\"preloadedJs\":[{\"path\":\"dist\\\/h5p-editor-audio-recorder.js\"}],\"preloadedDependencies\":[{\"machineName\":\"FontAwesome\",\"majorVersion\":4,\"minorVersion\":5},{\"machineName\":\"H5P.FontIcons\",\"majorVersion\":1,\"minorVersion\":0}]}"],"libraries\/H5PEditor.ColorSelector-1.3\/library.json":["application\/json","{\"title\":\"H5PEditor.ColorSelector\",\"majorVersion\":1,\"minorVersion\":3,\"patchVersion\":1,\"runnable\":0,\"machineName\":\"H5PEditor.ColorSelector\",\"coreApi\":{\"majorVersion\":1,\"minorVersion\":24},\"author\":\"Joubel\",\"preloadedJs\":[{\"path\":\"scripts\\\/spectrum.js\"},{\"path\":\"scripts\\\/color-selector.js\"}],\"preloadedCss\":[{\"path\":\"styles\\\/spectrum.css\"},{\"path\":\"styles\\\/color-selector.css\"}]}"],"libraries\/H5PEditor.VerticalTabs-1.3\/library.json":["application\/json","{\"machineName\":\"H5PEditor.VerticalTabs\",\"title\":\"H5P Editor Vertical Tabs\",\"license\":\"MIT\",\"author\":\"Joubel\",\"majorVersion\":1,\"minorVersion\":3,\"patchVersion\":9,\"runnable\":0,\"coreApi\":{\"majorVersion\":1,\"minorVersion\":24},\"preloadedJs\":[{\"path\":\"vertical-tabs.js\"}],\"preloadedCss\":[{\"path\":\"styles\\\/css\\\/vertical-tabs.css\"}],\"preloadedDependencies\":[{\"machineName\":\"FontAwesome\",\"majorVersion\":4,\"minorVersion\":5}]}"]});		H5PIntegration	= (function(x){
			let url	= window.location.href.split('/');
			url.pop();
			x.url	= url.join('/');
			return x;
		})({"baseUrl":"","url":"","siteUrl":"","l10n":{"H5P":{"fullscreen":"Vollbild","disableFullscreen":"Kein Vollbild","download":"Download","copyrights":"Nutzungsrechte","embed":"Einbetten","size":"Size","showAdvanced":"Show advanced","hideAdvanced":"Hide advanced","advancedHelp":"Include this script on your website if you want dynamic sizing of the embedded content:","copyrightInformation":"Nutzungsrechte","close":"Schlie\u00dfen","title":"Titel","author":"Autor","year":"Jahr","source":"Quelle","license":"Lizenz","thumbnail":"Thumbnail","noCopyrights":"Keine Copyright-Informationen vorhanden","reuse":"Wiederverwenden","reuseContent":"Verwende Inhalt","reuseDescription":"Verwende Inhalt.","downloadDescription":"Lade den Inhalt als H5P-Datei herunter.","copyrightsDescription":"Zeige Urheberinformationen an.","embedDescription":"Zeige den Code f\u00fcr die Einbettung an.","h5pDescription":"Visit H5P.org to check out more cool content.","contentChanged":"Dieser Inhalt hat sich seit Ihrer letzten Nutzung ver\u00e4ndert.","startingOver":"Sie beginnen von vorne.","by":"von","showMore":"Zeige mehr","showLess":"Zeige weniger","subLevel":"Sublevel","confirmDialogHeader":"Best\u00e4tige Aktion","confirmDialogBody":"Please confirm that you wish to proceed. This action is not reversible.","cancelLabel":"Abbrechen","confirmLabel":"Best\u00e4tigen","licenseU":"Undisclosed","licenseCCBY":"Attribution","licenseCCBYSA":"Attribution-ShareAlike","licenseCCBYND":"Attribution-NoDerivs","licenseCCBYNC":"Attribution-NonCommercial","licenseCCBYNCSA":"Attribution-NonCommercial-ShareAlike","licenseCCBYNCND":"Attribution-NonCommercial-NoDerivs","licenseCC40":"4.0 International","licenseCC30":"3.0 Unported","licenseCC25":"2.5 Generic","licenseCC20":"2.0 Generic","licenseCC10":"1.0 Generic","licenseGPL":"General Public License","licenseV3":"Version 3","licenseV2":"Version 2","licenseV1":"Version 1","licensePD":"Public Domain","licenseCC010":"CC0 1.0 Universal (CC0 1.0) Public Domain Dedication","licensePDM":"Public Domain Mark","licenseC":"Copyright","contentType":"Inhaltstyp","licenseExtras":"License Extras","changes":"Changelog","contentCopied":"Inhalt wurde ins Clipboard kopiert","connectionLost":"Connection lost. Results will be stored and sent when you regain connection.","connectionReestablished":"Connection reestablished.","resubmitScores":"Attempting to submit stored results.","offlineDialogHeader":"Your connection to the server was lost","offlineDialogBody":"We were unable to send information about your completion of this task. Please check your internet connection.","offlineDialogRetryMessage":"Versuche es wieder in :num....","offlineDialogRetryButtonLabel":"Jetzt nochmal probieren","offlineSuccessfulSubmit":"Erfolgreich Ergebnisse gesendet."}},"hubIsEnabled":false,"reportingIsEnabled":false,"libraryConfig":null,"crossorigin":null,"crossoriginCacheBuster":null,"pluginCacheBuster":"","libraryUrl":".\/libraries\/h5pcore\/js","contents":{"cid-memory-game":{"displayOptions":{"copy":false,"copyright":false,"embed":false,"export":false,"frame":false,"icon":false},"embedCode":"","exportUrl":false,"fullScreen":false,"contentUserData":[],"metadata":{"title":"Memory Game","license":"U"},"library":"H5P.MemoryGame 1.3","jsonContent":"{\"cards\":[{\"description\":\"Raspberries\",\"image\":{\"path\":\"images\\\/image-569deb3c2a249.jpg\",\"mime\":\"image\\\/jpeg\",\"copyright\":{\"license\":\"CC BY-NC\",\"author\":\"fir0002 | flagstaffotos.com.au\",\"title\":\"Raspberries04.jpg\",\"source\":\"https:\\\/\\\/commons.wikimedia.org\\\/wiki\\\/Raspberry#\\\/media\\\/File:Raspberries04.jpg\",\"version\":\"4.0\"},\"width\":200,\"height\":200},\"imageAlt\":\"Raspberries\",\"matchAlt\":\"Raspberries\"},{\"image\":{\"path\":\"images\\\/image-569deb5846a27.jpg\",\"mime\":\"image\\\/jpeg\",\"copyright\":{\"license\":\"CC BY-SA\",\"source\":\"https:\\\/\\\/commons.wikimedia.org\\\/wiki\\\/File:FraiseFruitPhoto.jpg\",\"author\":\"FoeNyx, France\",\"title\":\"FraiseFruitPhoto.jpg\",\"version\":\"4.0\"},\"width\":200,\"height\":200},\"description\":\"Strawberry\",\"imageAlt\":\"A strawberry\",\"matchAlt\":\"A strawberry\"},{\"image\":{\"path\":\"images\\\/image-569deb68ef662.jpg\",\"mime\":\"image\\\/jpeg\",\"copyright\":{\"license\":\"PD\",\"title\":\"Blackcurrant_carissa_spinarum.jpg\",\"source\":\"https:\\\/\\\/commons.wikimedia.org\\\/wiki\\\/File:Blackcurrant_carissa_spinarum.jpg\",\"author\":\"Paolo Neo\"},\"width\":200,\"height\":200},\"description\":\"Blackberry\",\"imageAlt\":\"A blackberry\",\"matchAlt\":\"A blackberry\"},{\"image\":{\"path\":\"images\\\/image-569debad2d8c4.jpg\",\"mime\":\"image\\\/jpeg\",\"copyright\":{\"license\":\"CC BY-SA\",\"title\":\"Cloudberry\",\"author\":\"Frode Petterson\",\"source\":\"http:\\\/\\\/www.joubel.com\",\"version\":\"4.0\"},\"width\":412,\"height\":412},\"description\":\"Cloudberry\",\"imageAlt\":\"A cloudberry\",\"matchAlt\":\"A cloudberry\"}],\"l10n\":{\"cardTurns\":\"Card turns\",\"timeSpent\":\"Time spent\",\"feedback\":\"Good work!\",\"tryAgain\":\"Reset\",\"closeLabel\":\"Close\",\"label\":\"Memory Game.\\u00a0Find the matching cards.\",\"done\":\"All of the cards have been found.\",\"cardPrefix\":\"Card %num:\",\"cardUnturned\":\"Unturned.\",\"cardMatched\":\"Match found.\"},\"behaviour\":{\"useGrid\":false,\"allowRetry\":true},\"lookNFeel\":{\"themeColor\":\"#909090\"}}"}}});