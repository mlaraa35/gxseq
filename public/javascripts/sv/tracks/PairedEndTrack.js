/*
 * The reads track shows short reads generated by high-throughput sequencing.
 * The display is rendered at three levels, histogram, boxes and sequence
 * This is slightly different from the stacks track which collapses reads
 */
AnnoJ.PairedEndTrack = function(userConfig)
{
	var self = this;
	
	AnnoJ.PairedEndTrack.superclass.constructor.call(self, userConfig);

	var defaultConfig = {
		single    : false,
		clsAbove  : 'AJ_above',
		clsBelow  : 'AJ_below',
		slider    : 0.5,
		boxHeight : 10,
		boxHeightMax : 24,
		boxHeightMin : 1,
		boxBlingLimit : 6
	};
	Ext.applyIf(self.config, defaultConfig);
	
	//Initialize the DOM elements
	var containerA = new Ext.Element(document.createElement('DIV'));
	var containerB = new Ext.Element(document.createElement('DIV'));
	
	containerA.addCls(self.config.clsAbove);
	containerB.addCls(self.config.clsBelow);
	
	//Force some styles
	containerA.setStyle('position', 'relative');
	containerB.setStyle('position', 'relative');
	containerA.setStyle('width', '100%');
	containerB.setStyle('width', '100%');
		
	containerA.setStyle('height', '49%');
	containerB.setStyle('height', '49%');

	containerA.setStyle('borderBottom', 'dotted black 1px');

	containerA.appendTo(self.Canvas.ext);
	containerB.appendTo(self.Canvas.ext);
		
	//Histogram mode
	var Histogram = (function()
	{
		var dataA = new HistogramData();
		var dataB = new HistogramData();
				
		function parse(data)
		{
			for (var series in data)
			{
				addLabel(series);
			}
			dataA.parse(data,true);
			dataB.parse(data,false);
		};
		
		var canvasA = new HistogramCanvas();
		var canvasB = new HistogramCanvas();
		canvasB.flipY();

		function paint(left, right, bases, pixels)
		{
			var subsetA = dataA.subset2canvas(left, right, bases, pixels);
			var subsetB = dataB.subset2canvas(left, right, bases, pixels);

			canvasA.setData(subsetA);
			canvasB.setData(subsetB);
			
			var max = Math.max(canvasA.getMax() || 0, canvasB.getMax() || 0);
			canvasA.normalize(max);
			canvasB.normalize(max);
			
			canvasA.paint();
			canvasB.paint();
		};
		
		return {
			dataA : dataA,
			dataB : dataB,
			canvasA : canvasA,
			canvasB : canvasB,
			parse : parse,
			paint : paint
		};
	})();

	//Reads mode
	var Reads = (function()
	{
		var dataA = new PairedReadsList();
		var dataB = new PairedReadsList();
	
		function parse(data)
		{
			for (var series in data)
			{
				addLabel(series);
			}
			dataA.parse(data,true);
			dataB.parse(data,false);
		};

		var canvasA = new PairedReadsCanvas({
			scaler : self.config.slider,
			boxHeight : self.config.boxHeight,
			boxHeightMax : self.config.boxHeightMax,
			boxHeightMin : self.config.boxHeightMin,
			boxBlingLimit : self.config.boxBlingLimit
		});
		var canvasB = new PairedReadsCanvas({
			scaler : self.config.slider,
			boxHeight : self.config.boxHeight,
			boxHeightMax : self.config.boxHeightMax,
			boxHeightMin : self.config.boxHeightMin,
			boxBlingLimit : self.config.boxBlingLimit
		});
		canvasB.flipY();
		
		function paint(left, right, bases, pixels)
		{
			var subsetA = dataA.subset2canvas(left, right, bases, pixels);
			var subsetB = dataB.subset2canvas(left, right, bases, pixels);

			canvasA.setData(subsetA);
			canvasB.setData(subsetB);
			
			canvasA.paint();
			canvasB.paint();
		};
		
		return {
			dataA : dataA,
			dataB : dataB,
			canvasA : canvasA,
			canvasB : canvasB,
			parse : parse,
			paint : paint
		};
	})();
	
	//Data handling and rendering object
	var handler = Histogram;
		
	//Zoom policies (dictate which handler to use)
	var policies = [
		{ index:0, min:1/100 , max:1/1    , bases:1   , pixels:100, cache:1000     },
		{ index:1, min:1/1   , max:10/1   , bases:1   , pixels:1  , cache:10000    },
		{ index:2, min:10/1  , max:100/1  , bases:10  , pixels:1  , cache:100000   },
		{ index:3, min:100/1 , max:1000/1 , bases:100 , pixels:1  , cache:1000000  },
		{ index:4, min:1000/1, max:10000/1, bases:1000, pixels:1  , cache:10000000 }
	];
	
	//Data series labels
	var labels = null;
		
	//Add series name to context menu (checkbox controls series visibility)
	function addLabel(name)
	{
		if (!labels)
		{
			self.ContextMenu.addItems(['-','Series']);
			labels = {};
		}

		if (labels[name] == undefined)
		{
			labels[name] = true;
		
			self.ContextMenu.addItems([
				new Ext.menu.CheckItem(
				{
					text    : name,
					checked : true,
					handler : function()
					{
						handler.canvasA.groups.toggle(name, !this.checked);
						handler.canvasB.groups.toggle(name, !this.checked);
						handler.canvasA.refresh();
						handler.canvasB.refresh();
					}
				})
			]);
		}
	};	
	
	this.getPolicy = function(view)
	{
		var ratio = view.bases / view.pixels;

		handler.canvasA.setContainer(null);
		handler.canvasB.setContainer(null);

		handler = (ratio < 10) ? Reads : Histogram;
		
		handler.canvasA.setContainer(containerA.dom);
		handler.canvasB.setContainer(containerB.dom);
		
		for (var i=0; i<policies.length; i++)
		{
			if (ratio >= policies[i].min && ratio < policies[i].max)
			{			
				return policies[i];
			}
		}
		return null;
	};
	
	this.rescale = function(f)
	{
		var f = (handler == Histogram) ? Math.pow(f*2, 4) : f;
		handler.canvasA.setScaler(f);
		handler.canvasB.setScaler(f);
		handler.canvasA.refresh();
		handler.canvasB.refresh();
	};
	this.clearCanvas = function()
	{
		handler.canvasA.clear();
		handler.canvasB.clear();
	};
	this.paintCanvas = function(l,r,b,p)
	{
		handler.paint(l,r,b,p);
	};
	this.refreshCanvas = function()
	{
		handler.canvasA.refresh(true);
		handler.canvasB.refresh(true);
	};
	this.resizeCanvas = function()
	{
		handler.canvasA.refresh(true);
		handler.canvasB.refresh(true);
	};
	this.clearData = function()
	{
		handler.dataA.clear();
		handler.dataB.clear();
	};
	this.pruneData = function(a,b)
	{
		handler.dataA.prune(a,b);
		handler.dataB.prune(a,b);
	};
	this.parseData = function(data)
	{
		handler.parse(data);
	};
};
Ext.extend(AnnoJ.PairedEndTrack,AnnoJ.BrowserTrack,{})
