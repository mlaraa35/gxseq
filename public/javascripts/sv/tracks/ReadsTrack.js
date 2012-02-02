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
	readLimit : 5000,
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
  	    
    //add Max and Scale info to the toolbar
    var scale_text = new Ext.Toolbar.TextItem({text:"Scale:",hidden: !self.Toolbar.isVisible(),});
    var abs_max_text = new Ext.Toolbar.TextItem({text:"",hidden: !self.Toolbar.isVisible(),});
    
    //update toolbar text
    function update_max_text(){
  	  abs_max_text.setText("Max Depth: "+self.absMax);
  	}
  	
  	self.Toolbar.insert(4,scale_text);
  	self.Toolbar.insert(4,abs_max_text);
  	
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
 			 setAbsMax : this.setAbsMax
     };
    })();
    
    //enable select event
	 	this.removeListener("selectStart",this.cancelSelectStart);
	 	
    this.on("selectEnd", function(startPos,endPos){
      if(startPos <0) startPos=0;
      //Grab some state information
      var bases = self.DataManager.views.requested.bases;
      var pixels = self.DataManager.views.requested.pixels;
      //create the readsDisplay
      var win = Ext.create('Sv.gui.ReadsWindow',{
        startBase : startPos,
        endBase : endPos,
        bases : bases,
        pixels: pixels,
        title : startPos+" - "+endPos+" : "+self.name
      })      
      win.show();
      win.loadData();
    });
    
    //Reads Display for select event
    
    Ext.define('Sv.gui.ReadsWindow',{
      extend:'Ext.Window',
      x: 100,
      y: 400,
      width:525,
      maxHeight:800,
      maxWidth:1000,
      minWidth:450,
      height:400,
      plain:true,
      layout:'fit',
      border:false,
      closable:true,
      //minimizable:true,
      maximizable:true,
      readLimit:5000,
      startBase:1,
      endBase:100,
      bases:1,
      pixels:1,
      initComponent : function(){
        
        this.callParent(arguments);
        var me = this;
        //initialize
        me.initialBases = me.bases;
        me.initialPixels = me.pixels;
        me.setRatio();
        me.readData = new ReadsList();
        me.readCanvas = new Sv.painters.ReadsCanvas({});
        me.colorBases = false;
        
        //div setup
        me.readContainer = new Ext.Element(document.createElement('DIV'));        
        me.readContainer.addCls(self.clsAbove);
       	me.readContainer.setStyle('position', 'relative');
       	
       	//window setup
       	var combo = Ext.create('Ext.form.field.ComboBox', {
            fieldLabel : "Read Limit",
            labelAlign : 'right',
            store: [10000,5000,1000,500,100],
            displayField: 'state',
            typeAhead: true,
            queryMode: 'local',
            triggerAction: 'all',
            selectOnFocus: true,
            labelWidth:75,
            width:150,
            editable: false,
            value: me.readLimit,
            iconCls: 'no-icon',
            listeners:{
              scope: me,
              'select': function(combo,records,opts){
                this.readLimit = records[0].data.field1;
                this.refresh();
              }
            }
        });

      	var colorBasesCheck = Ext.create('Ext.form.field.Checkbox', {
      	  fieldLabel : "Color Bases",
          labelAlign : 'right',
          name : 'colorBasesFlag',
          value : me.colorBases,
          labelWidth : 75,
          listeners:{
            scope: me,
            'change': function(checkbox,newVal,oldVal,opts){
              this.colorBases = newVal;
              this.refresh();
            }
          }
      	});
      	
      	me.panelText = new Ext.Toolbar.TextItem();
      	
       	me.readPanel = Ext.create('Ext.panel.Panel', {
          title: '',
          contentEl: me.readContainer.dom,
          autoScroll:true,
          tbar : [
            {
              xtype: 'button',
              iconCls : 'silk_zoom_in',
        			tooltip : 'Zoom in',
        			handler : function()
        			{
        			  me.zoomIn();
      			  }
            },
            {
              xtype: 'button',
              iconCls : 'silk_zoom_out',
        			tooltip : 'Zoom out',
        			handler : function()
        			{
        			  me.zoomOut();
      			  }
            },            
            colorBasesCheck,
            combo,
            '->',
            me.panelText
          ]
        });
        me.add(me.readPanel);
        me.setWidth(me.canvasWidth+30);

        //Canvas Set up
        me.readCanvas.setContainer(me.readContainer.dom);
        me.readCanvas.flipY();         
      },
      refresh : function(){
        var me = this;
        me.readData.clear();
        me.loadData();
      },
      loadData : function(){
        var me = this;
        me.requestReads(me.startBase,me.endBase,function(response){
          //parse the return
          var msg = me.readData.parse( response.data );
          me.panelText.setText(msg)
          var max = me.readData.levelize();
          //Setup Canvas data
          me.readContainer.setHeight(Math.max(max*((me.readCanvas.boxHeight*me.readCanvas.scaler)+me.readCanvas.boxSpace),me.readPanel.getHeight()));
          me.setCanvasData();
          //paint
          me.paintCanvas();          
        });
      },
      setRatio: function(){
        var me = this;
        me.ratio = me.pixels / me.bases;
        me.canvasWidth = (me.endBase-me.startBase) * me.ratio;
      },
      setCanvasData: function(){
        var me = this;
        me.setRatio();
        me.readCanvas.colorBases = me.colorBases;
        var subset = me.readData.subset2canvas(me.startBase, me.endBase, me.bases, me.pixels);
        me.readContainer.setWidth(me.canvasWidth);
        me.readCanvas.setViewport(me.startBase,me.endBase,me.bases,me.pixels);
        me.readCanvas.setData(subset);
      },
      paintCanvas : function(){
        var me = this;
        me.readCanvas.clear();
        me.readCanvas.paint();
      },
      zoomIn : function(){
        var me = this;
        //check boundary
        if(me.bases==1 && me.pixels>=20) return;
        //zoom in
        me.bases==1 ? me.pixels++ : me.bases--;
        //draw
        me.setCanvasData();
        me.paintCanvas();
      },
      zoomOut : function(){
        var me = this;
        //check boundary
        if(me.pixels==me.initialPixels && me.bases==me.initialBases) return;
        //zoom out
        me.pixels==1 ? me.bases++ : me.pixels--;
        //draw
        me.setCanvasData();
        me.paintCanvas();
      },
      requestReads : function(startPos,endPos,success){
        var me = this;
        Ext.Ajax.request({
          url: self.data,
          method: 'GET',
          params: {
            jrws: Ext.encode({
              method: 'reads',
              param: {
                id: self.id,
                experiment: self.experiment,
                left: startPos,
                right: endPos,
                bioentry: self.bioentry,
                read_limit : me.readLimit
              }
            })
          },
          success: function(response)
          { 
            success(Ext.JSON.decode(response.responseText));
          },
          failure: function(message)
          { 
            console.error('RequestReads failed for track ' + self.name + ' (' + message + ')');
          }
        });
      }
    });
    
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
  		scale_text.setText("Scale: "+handler.getScaler())
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
  }
});
