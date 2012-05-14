/*
 * The reads track shows short reads generated by high-throughput sequencing
 */
Ext.define("Sv.tracks.ReadsTrack",{
  extend : "Sv.tracks.BrowserTrack",
	clsAbove  : 'AJ_above',
	clsBelow  : 'AJ_below',
	color_above: '800000',
	color_below: '003300',
	scale  : 1.0,
	maxHeight : 5000,
	boxHeight : 12,
	boxHeightMax : 24,
	boxHeightMin : 1,
	boxBlingLimit : 4,
	pairedEnd : false,
	readLength : 36,
	readLimit : 1000,
  initComponent : function(){
    this.callParent(arguments);
    var self = this;
    this.absMax =-1;
    
    //Initialize the DOM elements
  	var containerA = new Ext.Element(document.createElement('DIV'));
  	containerA.addCls(self.clsAbove);
  	containerA.setStyle('position', 'relative');
  	containerA.setStyle('height', '100%');
  	containerA.setStyle('width', '100%');
  	containerA.appendTo(self.Canvas.ext);
    
    //Get the absolute max for this track
  	Ext.Ajax.request(
  	{		
  		url : self.data,
  		method : 'GET',
  		params : {
  			jrws : Ext.encode({
  				method : 'abs_max',
  				param  : {
  					experiment : self.experiment,
  					bioentry : self.bioentry
  				}
  			})
  		},	
  		success  : function(response)
  		{
  			self.absMax = parseInt(response.responseText);
  			self.refreshCanvas();
  			update_max_text();
  		},		
  	});
  	
  	this.lookupItem = function(id,pos){
  	  box = AnnoJ.getGUI().InfoBox;
			box.show();
			box.expand();
			box.echo("<div class='waiting'>Loading...</div>");
			box.setTitle("Read: "+id);
			Ext.Ajax.request({
				url         : self.data,
				method      : 'GET',
				requestJSON : false,
				params : {
					jrws : Ext.encode({
					  method 	: 'describe',
					  param  	: {
					    id : id,
					    bioentry : self.bioentry,
					    experiment : self.experiment,
					    pos : pos
					  }
					})
				},
				success  : function(response){
					if (response.status == 200){
	          var response_data = response.data;
	          box.echo(response.responseText);
					}
					else{
						box.echo("error:"+response.responseText);
					}
				},
				failure  : function(message){
					box.echo("Error: failed to retrieve gene information:<br/>"+message);
				}
			});
  	};
  	
  	var readLimitSelect = Ext.create('Ext.form.field.ComboBox', {
        fieldLabel : "Read Limit",
        labelAlign : 'right',
        hidden  : true,
        store: [10000,5000,1000,500,100],
        displayField: 'state',
        typeAhead: true,
        queryMode: 'local',
        triggerAction: 'all',
        selectOnFocus: true,
        labelWidth:75,
        width:150,
        editable: false,
        value: self.readLimit,
        iconCls: 'no-icon',
        listeners:{
          scope: self,
          'select': function(combo,records,opts){
            this.readLimit = records[0].data.field1;
            this.refresh();
          }
        }
    });
    
  	var colorBasesCheck = Ext.create('Ext.form.field.Checkbox', {
  	  fieldLabel : "Color Bases",
      labelAlign : 'right',
      hidden : true,
      name : 'colorBasesFlag',
      value : self.colorBases,
      labelWidth : 75,
      listeners:{
        scope: self,
        'change': function(checkbox,newVal,oldVal,opts){
          this.colorBases = newVal;
          this.refresh();
        }
      }
  	});
  	
    //add Max and Scale info to the toolbar
    var scale_text = new Ext.Toolbar.TextItem({text:"Scale:",hidden: !self.Toolbar.isVisible(),});
    var abs_max_text = new Ext.Toolbar.TextItem({text:"",hidden: !self.Toolbar.isVisible(),});
    //Handler toggle button
    var toggleHandlerBtn = Ext.create('Ext.button.Button',{
      iconCls: "sequence_track",
      listeners : {
        click : {
          fn : function(){
            this.toggle();
          }
        }
      },
      toggle: function(){
        if (handler == Reads){
          handler = Histogram;
          this.setIconCls("sequence_track");
          self.refresh();
          readLimitSelect.hide();
          colorBasesCheck.hide();
        }else{
          handler = Reads;
          this.setIconCls("silk_histogram");
          self.refresh();
          readLimitSelect.show();
          colorBasesCheck.show();
        }
      }
    });
    
    //update toolbar text
    function update_max_text(){
  	  abs_max_text.setText("Max Depth: "+self.absMax);
  	}
  	  	
  	self.Toolbar.insert(4,scale_text);
  	self.Toolbar.insert(4,abs_max_text);
  	self.Toolbar.insert(4,toggleHandlerBtn);
  	self.Toolbar.insert(4,readLimitSelect);
  	self.Toolbar.insert(4,colorBasesCheck);
  	
  	
  	//Histogram mode
    var Histogram = (function()
    {
     var dataA = new HistogramData();
     function parse(data)
     {      
       dataA.parse(data,true);
     };
    
     var canvasA = new Sv.painters.HistogramCanvas();
     canvasA.setColor(self.color_above);
     canvasA.setContainer(containerA.dom);    
     canvasA.flipY();
     
     function paint(left, right, bases, pixels)
     {
       var subsetA = dataA.subset2canvas(left, right, bases, pixels);    
       canvasA.setData(subsetA);
       canvasA.paint();
     };
    
    function getScaler(){
      return self.scale
    };
    function setScaler(s){
      self.scale =s;
      canvasA.setScaler(self.scale);
    };
    this.rescale = function(f)
    {
      setScaler(Math.pow(f*2, 4));
  		var f = getScaler();
  		canvasA.refresh();
  		scale_text.setText("Scale: "+f.toFixed(2)+" x");
    };
    this.clearCanvas = function()
    {
      canvasA.clear();
    };
  	this.refreshCanvas = function()
  	{
  	  canvasA.refresh(true);
  	};
  	this.resizeCanvas = function()
  	{
  	  canvasA.refresh(true);
  	};
  	this.clearData = function()
  	{
  	  dataA.clear();
  	};
  	this.pruneData = function(a,b)
  	{
  	  dataA.prune(a,b);
  	};
  	this.setAbsMax = function(m)
  	{
  	  canvasA.setAbsMax(m);
  	};
     return {
       dataA : dataA,
       canvasA : canvasA,
       parse : parse,
       paint : paint,
       getScaler : getScaler,
       setScaler : setScaler,
 			 rescale : this.rescale,
 			 clearCanvas : this.clearCanvas,
 			 refreshCanvas : this.refreshCanvas,
 			 resizeCanvas : this.resizeCanvas,
 			 clearData : this.clearData,
 			 pruneData : this.pruneData,
 			 setAbsMax : this.setAbsMax,
 			 method : 'range'
     };
    })();
    
    //Reads mode
    var Reads = (function()
  	{
  		var dataA = new ReadsList();
      var scaler = self.scaler;

  		var canvasA = new Sv.painters.ReadsCanvas({
  			scaler : self.scale,
  			boxHeight : self.boxHeight,
  			boxHeightMax : self.boxHeightMax,
  			boxHeightMin : self.boxHeightMin,
  			boxBlingLimit : self.boxBlingLimit,
  			pairedEnd : self.pairedEnd,
  			colorBases : self.colorBases
  		});
      
      canvasA.flipY();
      canvasA.setContainer(containerA.dom);
  		canvasA.on('itemSelected', self.lookupItem);
  		
  		function parse(data,x1,x2)
  		{
  			var msg = dataA.parse(data);
  			dataA.levelize();
  			canvasA.addBreak(x1,x2,msg);			
  		};
      
  		function paint(left, right, bases, pixels)
  		{
  			var subsetA = dataA.subset2canvas(left, right, bases, pixels);
  			canvasA.setData(subsetA);        
        canvasA.setViewport(left,right,bases,pixels);  			
  			canvasA.colorBases = self.colorBases;
  			canvasA.paint();
  		};
      
      function getScaler(){
        return scaler;
      };
      
      function setScaler(s){
        scaler = s;
        canvasA.setScaler(scaler);
      }
      this.rescale = function(f)
      {
        setScaler(f);
             var f = getScaler();
             canvasA.refresh();
             scale_text.setText("Scale: "+f.toFixed(2));
      };
      this.clearCanvas = function(){canvasA.clear();};
    	this.refreshCanvas = function(){canvasA.refresh(true);};
    	this.resizeCanvas = function(){canvasA.refresh(true);};
    	this.clearData = function(){dataA.clear();canvasA.clearBreaks();};
    	this.pruneData = function(a,b){dataA.prune(a,b);};
    	this.setAbsMax = function(){};
  		return {
  			dataA : dataA,
  			canvasA : canvasA,
  			parse : parse,
  			paint : paint,
        getScaler : getScaler,
        setScaler : setScaler,
  			clearCanvas : this.clearCanvas,
  			rescale : this.rescale,
  			refreshCanvas : this.refreshCanvas,
  			resizeCanvas : this.resizeCanvas,
  			clearData : this.clearData,
  			pruneData : this.pruneData,
  			//load : load,
  			setAbsMax : setAbsMax,
  			method : 'reads'
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
      { index:4, min:1000/1, max:10000/1, bases:1000, pixels:1  , cache:10000000 },
      { index:4, min:10000/1, max:100000/1, bases:10000, pixels:1  , cache:10000000 }
  	];

  	//Data series labels
  	var labels = null;

  	this.getPolicy = function(view)
  	{
  		var ratio = view.bases / view.pixels;

      handler.canvasA.setContainer(null);
      handler.setAbsMax(self.absMax);
      handler.canvasA.setContainer(containerA.dom);
  		scale_text.setText("Scale: "+handler.getScaler());
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
  	  handler.rescale(f);
  	};
  	this.clearCanvas = function()
  	{
  		handler.clearCanvas();
  	};
  	this.paintCanvas = function(l,r,b,p)
  	{
  		handler.paint(l,r,b,p);
  	};
  	this.refreshCanvas = function()
  	{
  	  handler.refreshCanvas();
  	};
  	this.resizeCanvas = function()
  	{
  	  handler.refresh();
  	};
  	this.clearData = function()
  	{
  	  handler.clearData();
  	};
  	this.pruneData = function(a,b)
  	{
  	  handler.pruneData(a,b);
  	};
  	this.parseData = function(data, x1, x2)
  	{
  		handler.parse(data, x1, x2);
  	};
  	this.requestFormat = function(){
  	  handler.method;
  	}
  	this.requestFrame = function(frame,pos,policy,successFunc,failureFunc){
  	  Ext.Ajax.request({
          url: self.data,
          method: 'GET',
          params: {
              jrws: Ext.encode({
                  method: handler.method,
                  param: {
                      id: self.id,
                      experiment: self.experiment,
                      left: pos.left,
                      right: pos.right,
                      bases: policy.bases,
                      pixels: policy.pixels,
                      bioentry: self.bioentry,
                      read_limit : self.readLimit
                  }
              })
          },
          success: function(response)
          {
              response = Ext.JSON.decode(response.responseText);
              successFunc(response);
          },
          failure: function(message)
          {
            failureFunc(message);
          }
      });
  	};
  }
});
