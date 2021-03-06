//AnnoJ singleton object
var AnnoJ = (function()
{	
    
	var defaultConfig = {
	    renderTo    : 'main',
		tracks    : [],
		active    : [],
		genome    : '',
		bookmarks : '',
		styles    : [],
		location  : {
			assembly : '3',
			position : 15678,
			bases : 25,
			pixels : 2
		},
		admin : {
			name  : '',
			email : '',
			notes : ''
		},
		cls : 'tracks',
		debug: true,
		citation : ''
	};
	var config = defaultConfig;
	var GUI = {};
	var height = 700;
	var self = this;
	self.localHistMax = 1;
	self.globalHistMax = 1;
	self.localMaxes = {};
	//self.globalMaxes = [1];
	
	function init()
	{	
		//Clear any localStorage
		localStorage.clear();
    
    //Check that the browser is compatible
		if (!WebApp.checkBrowser())
		{	
			WebApp.bombBrowser();
			return false;
		}
		
		//Create the message box
		var progressBar = Ext.Msg.show({progress: true});
		
		//Allowing GC to run will cause problems with the current appendTo, removeChild setup for track display.
		Ext.enableGarbageCollector = false;
		
		//Set configuration options
		progressBar.updateProgress(0.10, 'Applying configuration...');	
			
		if (!AnnoJ.config)
		{
			progressBar.hide();		
			WebApp.error('Unable to find configuation object (AnnoJ.config). The application cannot be built.');
			return false;
		}
		Ext.apply(config, AnnoJ.config || {}, defaultConfig);
		
		//Build the GUI
		progressBar.updateProgress(0.15, 'Building GUI...');	
		
		// try
		// {
			GUI = buildGUI();
		// }	
		// catch (e)
		// {
		// 	Ext.MessageBox.hide();		
		// 	WebApp.exception(e, 'An exception was encountered when AnnoJ attempted to initialize the graphical user interface. Please notify the website administrator so that this may be addressed.');
		// 	return false;
		// };
		
		//Syndicate the genome
		progressBar.updateProgress(0.5, 'Loading genomes...');
    GUI.NavBar.syndicate(
       {
        url : config.genome,
        bioentry : config.bioentry,
        success : function(response)
        {
          progressBar.updateProgress(0.75, 'Building tracks...');
          GUI.NavBar.setLocation(config.location);
          buildTracks();
          progressBar.updateProgress(1.0, 'Finished');
          progressBar.hide();
          GUI.NavBar.fireEvent('browse', GUI.NavBar.getLocation());
          //GUI.NavBar.setLocation(config.location);
        },
        failure : function(string)
        {
          progressBar.hide();
          Ext.MessageBox.alert('Error', 'Unable to load genomic metadata from address: ' + config.genome);
        }
    });
    
    //bind key events
  	Ext.EventManager.addListener(window, 'keyup', function(event){
  		if (event.getTarget().tagName == 'INPUT') return;
  		switch (event.getKey())
  		{
  			case event.B : GUI.Tracks.setDragMode('browse', true); break;
  			case event.E : GUI.Tracks.setDragMode('select',true); break;
  			case event.R : GUI.Tracks.setDragMode('resize', true); break;
  			case event.S : GUI.Tracks.setDragMode('scale', true); break;
  			case event.Z : GUI.Tracks.setDragMode('zoom', true); break;
  			case event.U : GUI.NavBar.recallZoom(); break;
  		}
  	},this);
  	
	};
	
	//Build all the tracks
	function buildTracks()
	{
	  //Create and add the RulerTrack
	  var ruler = Ext.create("Sv.tracks.RulerTrack",{});
	  GUI.Tracks.tracks.manage(ruler);
	  GUI.Tracks.tracks.open(ruler);
	  
	  //Create user tracks, add to tree, open active tracks
		GUI.TrackSelector.expand();
		Ext.each(config.tracks, function(trackConfig, index)
		{
      var track = new Sv.tracks[trackConfig.type](trackConfig);
      //Add the track to the track selector tree and the track main window
      GUI.Tracks.tracks.manage(track);
      GUI.TrackSelector.manage(track);
      //Bind app wide events
      track.on('open',setupTrack);
      track.on('close',function(){
        closeTrack(this);
      });
      track.on('frameLoaded',handleFrame)
		});
		//Hook the info buttons of all of the tracks
    Ext.each(GUI.Tracks.tracks.tracks, function(track)
    {
      track.on('describe', function(htmlText)
      {
        box = AnnoJ.getGUI().InfoBox;
        box.setTitle(track.name)
        box.show();
        box.expand();
        box.echo(htmlText);
      });
    });
		//Activate the default tracks
		Ext.each(config.active, function(id)
		{
			var track = GUI.Tracks.tracks.find('id', id);
			if (track)
			{
				GUI.TrackSelector.activate(track);
				GUI.Tracks.tracks.open(track);
				//gene_id API  -  auto load InfoBox if the gene_model_id config property is set.
				if(config.gene_id && track instanceof Sv.tracks.ModelsTrack )
				{
				    track.lookupModel(config.gene_id)
				}
				//feature_id API  -  auto load InfoBox if the feature_id config property is set.
				if(config.feature_id && track instanceof Sv.tracks.GenericFeatureTrack )
				{
				    track.lookupModel(config.feature_id)
				}
			}
		});
		GUI.TrackSelector.active.expand();
		GUI.TrackSelector.inactive.expand();
		GUI.Viewport.doLayout();
  	
	};
	
	//Build the GUI
	function buildGUI()
	{
		//Ext.Compat.showErrors = true;
		//Build the GUI components
		//var Messenger = new AnnoJ.Messenger();
        


		// var Bookmarker = new AnnoJ.Bookmarker({
		// 	datasource : config.bookmarks || config.genome
		// });
		// 
		// var StyleSelector = new AnnoJ.StyleSelector({
		// 	styles : config.styles
		// });

		var LayoutBox = new AnnoJ.LayoutBox();
    LayoutBox.setLoadPath(config.layout_path);
    
		var InfoBox = new AnnoJ.InfoBox();

    //var EditBox = new AnnoJ.EditBox();
    // EditBox.hide();

        // var AboutBox = new AnnoJ.AboutBox({
        //  admin : config.admin
        // });
		
		
		//var Bugs = new AnnoJ.Bugs();
		
		var NavBar = new AnnoJ.Navigator();
	
		var Tracks = new AnnoJ.Tracks({
			//tbar : NavBar.ext,
			tracks : config.tracks,
			activeTracks : config.active
		});
		
		// Track Selector Tree
    var TrackSelector = new Sv.gui.TrackSelector({
     activeTracks : config.active,
     trackManager : Tracks
    });

		Tracks.addDocked(NavBar.ext,0)
		if (config.citation)
		{
			AboutBox.addCitation(config.citation);
		}
		
		var Accordion = Ext.create('Ext.panel.Panel',
		{
			title        : 'Configuration',
			region       : 'west',
			layout       : 'accordion',
			iconCls      : 'silk_wrench',
			collapsible  : true,
			split        : true,
			minSize      : 160,
			width        : 260,
			maxSize      : 400,
			margins      : '0 0 0 0',
			items : [
				//AboutBox,
				LayoutBox,
			  TrackSelector,
			  InfoBox
        //EditBox,
			    //Bugs,
			    //Messenger
			    //StyleSelector,
			    //Bookmarker
			]
		});
		var Viewport = Ext.create('Ext.panel.Panel',
		{
			renderTo: config.renderTo,
			//width: 	 '100%',
			height: height,
			layout 	: 'border',
			items  	: [
				Accordion,
				Tracks
			]
		});
		this.renderDiv = Ext.get(config.renderTo);
		Viewport.setWidth(this.renderDiv.getWidth())
		Ext.EventManager.addListener(window, 'resize', function(){
		      GUI.Viewport.setWidth(self.renderDiv.getWidth())
    	    GUI.Viewport.doLayout();
    	    GUI.Tracks.tracks.doLayout();
    	});
		//Hook GUI components together via events
		NavBar.on('describe', function(syndication) {
			InfoBox.echo(BaseJS.toHTML(syndication));
			InfoBox.expand();
		});
		NavBar.on('browse', setLocation);
		
		NavBar.on('dragModeSet', Tracks.setDragMode);
		Tracks.on('dragModeSet', NavBar.setDragMode);
    // Tracks.on('refresh',function(){
    //   //setLocation();
    //   //resetHeight();
    //   //updateState();
    // });
    Tracks.on('browse',setLocation);
    TrackSelector.on('openTrack', Tracks.tracks.open);
    TrackSelector.on('moveTrack', Tracks.tracks.reorder);
    TrackSelector.on('closeTrack', Tracks.tracks.close);
    
		InfoBox.hide();
		Viewport.doLayout();
		
		// Setup touch events for track selector
		// This emulates right click
		selectorDom = TrackSelector.getEl().dom
		selectorDom.setAttribute("ontouchstart", "this.handleTouchStart(event);")
		selectorDom.handleTouchStart=function(event){
		  var ev = document.createEvent('HTMLEvents')
		  ev.initEvent('contextmenu', true, false);
      event.toElement.dispatchEvent(ev);
		}
		return {
			//Messenger : Messenger,
			TrackSelector : TrackSelector,
			InfoBox : InfoBox,
			//EditBox : EditBox,
			LayoutBox: LayoutBox,
			//AboutBox : AboutBox,
			NavBar : NavBar,
			Tracks : Tracks,
			Accordion : Accordion,
			Viewport : Viewport,
			//alert : alert,
			//error : error,
			//warning : warning,
			//notice : notice
		};
	};
	
	//post current layout to the config URL
	function postLayout(layout_name){
		post_config = 
		{
			url         : AnnoJ.config.layout_path,
			method      : 'POST',
			requestJSON : false,
			data				: 
			{
				name			: layout_name,
				assembly_id : AnnoJ.config.assembly_id,
				active_tracks	: GUI.TrackSelector.getActiveTrackString(),
				track_configurations : Ext.JSON.encode(getActiveTracks().getConfigs()),
				location	:  Ext.JSON.encode(getLocation())
			},
			success : function(){
				GUI.LayoutBox.refresh();
				GUI.LayoutBox.expand();	
			},
			failure : function(response){
				window.alert("Error: "+ response);
			}
		}
		BaseJS.request(post_config);
	};
	
	function getLocation() {
		return GUI.NavBar.getLocation();
	};
	function getTrack(id) {
	  return GUI.Tracks.tracks.find('id', id);
	    // return GUI.Track.tracks
	};
	function getActiveTracks() {
	  return GUI.Tracks.tracks;
	};
	function setLocation(location) {
		result = GUI.NavBar.setLocation(location);
		//clear max storage
		self.localMaxes={};
		//Lookup all local maximums
	  Ext.each(GUI.Tracks.tracks.active,function(track){
	    if(track.getViewMax){
	      var tType = track.sample_type||track.type
	      self.localMaxes[tType]=self.localMaxes[tType]||[1]
	      self.localMaxes[tType].push(track.getViewMax(location));
	    }
	  });
	  //Apply max to tracks
    Ext.each(GUI.Tracks.tracks.active,function(track){
	    if(track.setAllViewMax){
	      var tType = track.sample_type||track.type
	      var tTypeMax = Math.max.apply(null,localMaxes[tType]);
        track.setAllViewMax(tTypeMax);
      }
    });
	  // Update the track manager location
	  // This updates all tracks and re-renders the view
	  GUI.Tracks.tracks.setLocation(result);
	  // update our state (history)
	  updateState();
	};
	function pixels2bases(pixels) {
		return GUI.NavBar.pixels2bases(pixels);
	};
	function bases2pixels(bases) {
		return GUI.NavBar.bases2pixels(bases);
	};
	function xpos2gpos(xpos) {
		return GUI.NavBar.xpos2gpos(xpos);
	};
	function gpos2xpos(gpos) {
		return GUI.NavBar.gpos2xpos(gpos);
	};
	function getGUI() {
		return GUI;
	};	
	function resetHeight(){
		total_height = GUI.NavBar.ext.getHeight()+2;
		Ext.each(GUI.Tracks.tracks.active, function(t)
		{
			total_height+=(t.height+2)
		});
		
		if(total_height < height){
			total_height = height
		}
		GUI.Viewport.setHeight(total_height);
		GUI.Viewport.doLayout();
	};
	function valueToSize(value, precision, divisor, sizes){    
    var posttxt = 0;
    if (value == 0) return '0';
    while( value >= divisor ) { 
        posttxt++;
        value = value / divisor;
    }
    return value.toFixed(precision) + sizes[posttxt];
  };
	function numberToSize(number, precision) {
    var sizes = ['', 'KB', 'MB', 'GB', 'TB', 'PB'];
    return valueToSize(number,precision,1000,sizes);
  };
  function bytesToSize(bytes, precision){
    var sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
    return valueToSize(bytes,precision,1024,sizes);
  };
  function updateState() {
    loc = GUI.NavBar.getLocation();
    newSearch = "?pos="+loc.position
    newSearch += "&b="+loc.bases
    newSearch += "&p="+loc.pixels
    newSearch += activeTrackParams();
    window.history.replaceState("Data","Sequence Viewer",newSearch)
  };
  //Convert the active tracks into a parameter string
  function activeTrackParams(){
    text = '';
    Ext.each(GUI.TrackSelector.getActiveIDs(), function(active_id){
      text += "&tracks[]="+active_id
    });
    return text
  };
  //Load Track with data. Replacing internal setLocation with managed event.
  function handleFrame(track){
    //for now, we re-render every frame load
    setupTrack(track);
  }
  //initialize the track and set its location - changes any correlated data
  //NOTE: this causes re-rendering during loads but avoids any concurrency/race conditions
  // It would be better to look through correlated tracks and find out IF we need to update first
  function setupTrack(track){
    //track.setLocation(getLocation());
    setLocation(getLocation);
  };
  //close the track and remove its data
  //re-render all tracks after a close to change any correlated data
  function closeTrack(track){
    setLocation(getLocation);
  };
  return {
    ready           : true,
    init            : init,
    getTrack        : getTrack,
    getActiveTracks : getActiveTracks,
    getLocation     : getLocation,
    setLocation     : setLocation,
    pixels2bases    : pixels2bases,
    bases2pixels    : bases2pixels,
    xpos2gpos       : xpos2gpos,
    gpos2xpos       : gpos2xpos,
    getGUI          : getGUI,
    resetHeight			: resetHeight,
    Plugins         : {},
    Helpers         : {},
    postLayout			: postLayout,
    numberToSize    : numberToSize,
    bytesToSize     : bytesToSize,
    activeTrackParams:activeTrackParams
  };
})();
