;(function ($, window, document, undefined) {

	var pluginName = 'Input';

	var defaults = {
		value:'',
		validate: false,
		required: false,
		type: 'text',
		validation: {
			test: function(){
				return true;
			}
		}
	};

	function Plugin(element, options) {
		this.$el = $(element);
		this.options = $.extend({}, defaults, options);
		this.init();
	}

	Plugin.prototype.init = function () {
		this.markup();
		this.setValue(this.options.value);
		this.bindEvents();
	};

	Plugin.prototype.markup = function () {
		this.$input = $('<input>').attr('type', this.options.type).addClass('uilib-input');
		this.$el.append(this.$input);
	};

	Plugin.prototype.bindEvents = function () {
		var input = this;
		input.$input.change(function(){
			input.setValue(input.$input.val());
			input.$input.trigger(pluginName + '.change', input.getValue());
		});
		input.$input.on('keyup',function(){
			input.setValue(input.$input.val());
		});
	};

	Plugin.prototype.getValue = function () {
		return this.value;
	};

	Plugin.prototype.setValue = function (value) {
		var isPassRequiredValidation = this.options.required ? !!value.length : true; 		
		var isDifferentValue = (this.$input.val() !== this.value || value !== this.value);
		
		if(isPassRequiredValidation && this.options.validation.test(value) && isDifferentValue){
			this.lastValue = this.getValue();
			this.$input.val(value);
			this.value = value;
			if(this.options.validate){
			    this.$input.removeClass('invalid-input').addClass('valid-input');
			}
		} else if(this.$input.val() !== this.value){
			this.value = '';
			if(this.options.validate){
				this.$input.removeClass('valid-input').addClass('invalid-input');
			}
		}
	};

	Plugin.prototype.disable = function () {
		this.$el.addClass('disabled');
	};

	Plugin.prototype.enable = function () {
		this.$el.removeClass('disabled');
	};

	Plugin.prototype.isDisabled = function () {
		return this.$el.hasClass('disabled');
	};

	$.fn[pluginName] = function (options) {
		return this.each(function () {
			if (!$.data(this, 'plugin_' + pluginName)) {
				$.data(this, 'plugin_' + pluginName, new Plugin(this, options));
			}
		});
	};

})(jQuery, window, document);
