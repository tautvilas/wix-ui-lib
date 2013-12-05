(function (exports){

	holdJQueryDOMReady();
	
	var model = createModel();
	var styleModel = createModel();
	
	exports.UI = {
		initialize: initialize,
		initializePlugin:initializePlugin,
		initStyleMigration: initStyleMigration,
		set: model.setAndReport,
		get: model.get,
		toJSON: model.toJSON,
		onChange: model.onChange
	};
		
	function log(){
		var args = ['<ui-lib>'];
		args.push.apply(args,arguments);
		false && console.log.apply(console, args);
	}
	
    function initialize(initialValues, onModelChange) {
		if(initialize.isInitialized){return;}
		initialize.isInitialized = true;
		initialize.retry = ++initialize.retry || 1;
		
    	var $rootEl = $('body'); //$('[wix-uilib],[data-wix-uilib]');
    	if ($rootEl.length > 1) {
    		throw new Error('You have more then one wix-uilib element in the DOM.');
    	}
    	applyPremiumItems($rootEl);
    	
		model.setInitialValues(initialValues);
    	onModelChange && model.onChange('*', onModelChange);
		
		initStyleModelHandling();
		
    	var elements = $rootEl.andSelf().find('[data-wix-controller], [wix-controller], [wix-ctrl], [data-wix-ctrl]');
    	for (var i = 0; i < elements.length; i++) {
    		try {
    			initializePlugin(elements[i]);
    		} catch (err) {
    			console.log && console.log('Plugin Initialization Error: ' + err.stack, elements[i]);
    		}
    	}
							
		if(styleModel.applyStyleMigration){
			styleModel.applyStyleMigration();
		}

    	$rootEl.fadeIn(140, function(){
			$(document.body).trigger('uilib-update-scroll-bars');
		});
		
    }
	
	function holdJQueryDOMReady(){
		var timeoutTicket;
		if(window.Wix){
			if(Wix.Utils.getViewMode() === 'standalone'){
				setTimeout(function(){
					throw new Error('Standalone mode: Wix style params are not available outside of the "wix editor"');
				},0);
			} else {
				holdReady(true);
				timeoutTicket = setTimeout(function(){
					holdReady(false);
					throw new Error('Style params are not available outside of the "wix editor", if you are in the editor ');		
				}, 3333);
				Wix.getStyleParams(function(){
					clearTimeout(timeoutTicket);
					holdReady(false);
				});				
			}
		}

		function holdReady(hold){
			window.jQuery && window.jQuery.holdReady && window.jQuery.holdReady( hold );
		}
	}
	
	function getVendorProductId() {
		try {
			var inst = window.location.search.match(/instance=([^&]+)/);
			return JSON.parse(atob(inst[1].split('.')[1])).vendorProductId || null;
		} catch (err) {
			return null;
		}
	}
	
	function applyPremiumItems($rootEl){
		var $premium = $rootEl.find('[wix-premium],[data-wix-premium]');
		var $notPremium = $rootEl.find('[wix-not-premium], [data-wix-not-premium]');
		var isPremium = getVendorProductId();
		if(isPremium){
			$premium.show();
			$notPremium.remove();
		} else {
			$premium.remove();
			$notPremium.show();
		}
	}
	
	function getAttribute(element, attr) {
		var val = element.getAttribute(attr);
		if (!val) {
			val = element.getAttribute('data-' + attr);
		}
		return val;
	}
		
    function initializePlugin(element) {
        var ctrl = getAttribute(element, 'wix-controller') || getAttribute(element, 'wix-ctrl') ;
		var ctrlName = getCtrlName(ctrl);
		var options = getOptions(element, ctrl);
		applyPlugin(element, ctrlName, options);
    }
	
	function applyPlugin(element, pluginName, options) {
		pluginName = fixPluginName(pluginName);
		if ($.fn[pluginName]) {
			log('initializing ' + pluginName, options);
			$(element)[pluginName](options);
		} else {
			console.error('Plugin ' + pluginName + ' does not exist');
		}
		setUpStyleParams(element, pluginName);
		setUpModel(element, pluginName);
	}

	function setUpStyleParams(element, pluginName){
		var wixStyleParam = getAttribute(element, 'wix-param');
		if(wixStyleParam){
			styleModel.bindKeyToPlugin(element, pluginName, wixStyleParam);
		}
	}
	
	function setUpModel(element, pluginName){
		var wixModel = getAttribute(element, 'wix-model');
		if(wixModel){
			model.bindKeyToPlugin(element, pluginName, wixModel);
		}
	}
	
	function evalOptions(options){
		 try{
			return (new Function('return '+ options + ';'))()
		 }catch(e){
			throw new Error('Options for plugin are not valid: ' + options);
		 }
	}
	
	function fixPluginName(pluginName){
		return pluginName;
	}
	
	function getOptions(element, ctrl){
		var options = getOptionsFormCtrl(ctrl);
		if (!options) {
			options = getAttribute(element, 'wix-options');
		}
		return evalOptions(options) || {};
	}
	
    function getOptionsFormCtrl(ctrl) {
		var index = ctrl.indexOf(':');
        if (index !== -1) {
            return ctrl.substr(index + 1);
        }
		return false;
    }

    function getCtrlName(ctrl) {
		var index = ctrl.indexOf(':');
        if (index !== -1) {
            return ctrl.substr(0, index);
        }
		return ctrl;
    }
	
	function createModel() {
		var model = {
			props : {},
			handlers : [],
			reporters : {},
			isReporting : true,
			get : function (modelKey) {
				if (!model.props.hasOwnProperty(modelKey)) {
					throw new Error('There is no "' + modelKey + '" in this model. try to define "wix-model" in your markup.');
				}
				return model.props[modelKey];
			},
			set : function (modelKey, value, silent, report, plugin) {
				var ignoreSet = false;
				if (!model.props.hasOwnProperty(modelKey)) {
					throw new Error('There is no "' + modelKey + '" in this model. try to define "wix-model" in your markup.');
				}
				if(value && value._model_ignore_set_){
					delete value._model_ignore_set_;
					ignoreSet = true;
				}
				var oldValue = model.props[modelKey];
				if (oldValue !== value) {
					model.props[modelKey] = value;
					if (!silent) {
						model.trigger(modelKey, value);
					}
					if(ignoreSet){return}
									//if(report){
					model.triggerReporters(modelKey, value, plugin);
									//}
				}
			},
			setAndReport : function (modelKey, value, isSilent) {
				model.set(modelKey, value, !!isSilent || false, true);
			},
			setInitialValues : function (initialValues) {
				$.extend(model.props, initialValues);
			},
			bindKeyToPlugin : function (element, pluginName, modelKey) {
				var $el = $(element);
				var plugin = $el.data('plugin_' + pluginName);
				if (!plugin) {
					throw new Error('wix-model is not supported in this plugin "' + pluginName + '"')
				}
				var initValue = model.props[modelKey];
				if (initValue !== undefined) {
					plugin.setValue && plugin.setValue(initValue);
				} else {
					initValue = plugin.getValue ? plugin.getValue() : undefined;
					model.props[modelKey] = initValue;
				}
				$el.on(pluginName + '.change', function (e, data) {
					model.set(modelKey, data, false, false, plugin);
				});
				model.reporters[modelKey] = model.reporters[modelKey] || [];
				function setValueFromReport(value) {
					plugin.setValue && plugin.setValue(value);
				}
				setValueFromReport.plugin = plugin;
				model.reporters[modelKey].push(setValueFromReport);
			},
			onChange : function (key, fn) {
				if (typeof fn !== 'function') {
					throw new Error(key + ': You must provide fn as handler to the Model change event.');
				}
				model.handlers.push({
					fn : fn,
					key : key
				});
			},
			trigger : function (modelKey, value) {
				for (var i = 0; i < model.handlers.length; i++) {
					try {
						var handler = model.handlers[i];
						if (handler.key === '*' || handler.key === modelKey) {
							handler.fn.call(model, value, modelKey);
						}
					} catch (err) {
						setTimeout(function () {
							throw err;
						}, 0);
					}
				}
			},
			triggerReporters : function (modelKey, value, plugin) {
				if (!model.isReporting) {
					return;
				}
				var reportes = this.reporters[modelKey];
				for (var i = 0; i < reportes.length; i++) {
					var reporter = reportes[i];
					if(reporter.plugin === plugin){
						continue;
					}
					try {
						reporter.call(model, value, modelKey);
					} catch (err) {
						setTimeout(function () {
							throw err;
						}, 0);
					}
				}
			},
			toJSON : function () {
				return $.extend({}, model.props);
			}
		};
		
		return model;

	}
	
	
	/////////////////////////////////////////////////
	/////////////////////STYLE///////////////////////
	/////////////////////////////////////////////////

	function initStyleModelHandling(){
		if(window.Wix){
		
			var style = Wix.Settings.getStyleParams();
			
			if(!styleModel.applyStyleMigration){
				var styles;
				try{
					styles = flattenStyles(style);
				}catch(err){
					setTimeout(function(){
						throw err
					},0)
					styles = {};
				}
				styleModel.setInitialValues(styles);
				
			}
			
			styleModel.onChange('*', function(value, name){
				if(isNumberParam(value)){
					Wix.Settings.setNumberParam(name, {value:getNumberParamValue(value)});
				} else if(Object.prototype.toString.call(value).match('Boolean')){
					Wix.Settings.setBooleanParam(name, {value:value});
				} else if(value && (value.hasOwnProperty('color') || value.cssColor || value.rgba)) {
					Wix.Settings.setColorParam(name, {value:value});
				}
			});
			
		}
		
		function isNumberParam(value){
			if(value instanceof Number || typeof value === 'number' || (!Number.isNaN(+value.index) && value.value)){
				return true;
			}
			return false;
		}
		
		function getNumberParamValue(value){
			return ( value.index || value.index === 0 ) ? value.index : value;
		}
		
	}
	
	function initStyleMigration(initValues){
		styleModel.applyStyleMigration = function(){
			for(var key in initValues){
				if(initValues.hasOwnProperty(key)){
					styleModel.set(key, initValues[key]);
				}
			}		
		}
	}
	
	function flattenStyles(style){
		style = style || {};
		var mergedStyle = {};
		//when there will be more types we should merge them
		for(var prop in style.colors){
			if(style.colors.hasOwnProperty(prop)){
				if(style.colors[prop].themeName && style.colors[prop].value.indexOf('rgba')===0){
				
					var opacity = style.colors[prop].value.match(/,([^),]+)\)/);
					opacity = (opacity ? (+opacity[1]) : 1);
				
					mergedStyle[prop] = {
						color : {
							reference : style.colors[prop].themeName,
							value : style.colors[prop].value
						},
						rgba : style.colors[prop].value,
						opacity : opacity
					};
				}else{
					mergedStyle[prop] = style.colors[prop].themeName || style.colors[prop].value;
				}
			}
		}
		for(var prop in style.numbers){
			if(style.numbers.hasOwnProperty(prop)){
				mergedStyle[prop] = style.numbers[prop];
			}
		}
		for(var prop in style.booleans){
			if(style.booleans.hasOwnProperty(prop)){
				mergedStyle[prop] = style.booleans[prop];
			}
		}
		return mergedStyle;
	}
	/////////////////////////////////////////////////
	/////////////////////////////////////////////////
	/////////////////////////////////////////////////
	
	
})(window.Wix || window);

