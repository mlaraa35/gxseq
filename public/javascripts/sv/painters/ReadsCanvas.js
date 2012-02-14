/*
 * Class for displaying short DNA reads as non-overlapping boxes. Shows sequence when zoomed in close
 */
Ext.define('Sv.painters.ReadsCanvas',{
  extend: 'Sv.painters.BoxesCanvas',
  boxHeight : 12,
	boxHeightMax : 24,
	boxHeightMin : 1,
	boxBlingLimit : 4,
	boxSpace : 4,
	pairedEnd : false,
	ratio : 1,
	frameBreaks : [],
	viewport : {},
	readColor : '#44D',
	colorBases : true,
  initComponent: function(){
    var self = this;
    self.callParent(arguments);
    
    self.addEvents({
			'itemSelected' : true
		});
		
  	//Set the data for this histogram from an array of points
  	this.setData = function(reads)
  	{
  		if (!(reads instanceof Array)) return;

  		Ext.each(reads, function(read)
  		{
  			self.groups.add(read.cls);
  		});
  		data = reads;
  	};

  	//Toggle the state of elements containing the specified class name
  	this.toggleSpecial = function(targetCls, state)
  	{
  		var list = self.groups.getList();

  		for (var cls in list)
  		{
  			if (cls.indexOf(targetCls) != -1)
  			{
  				self.groups.toggle(cls, state);
  			}
  		}
  	};
    
    //Add a new frameBreak
    this.addBreak = function(x1,x2,msg)
    {
      self.frameBreaks.push({x1 : x1, x2 : x2, msg : msg})
    };
    //Clear frameBreaks
    this.clearBreaks = function()
    {
      self.frameBreaks = [];
    };
    
    // View ratio for rendering
    this.setViewport = function(x1,x2,bases,pixels)
    {
      self.viewport = {
        x1:x1,
        x2:x2,
        bases:bases,
        pixels:pixels
      }
    };
    
  	//Draw points using a specified rendering class
  	this.paint = function()
  	{
  		this.clear();
  		var container = this.getContainer();
  		var canvas = this.getCanvas();
  		var region = this.getRegion();
  		var width = this.getWidth();
  		var height = this.getHeight();
  		var brush = this.getBrush();
  		var scaler = this.getScaler();
  		var flippedX = this.isFlippedX();
  		var flippedY = this.isFlippedY();
      
      if(!region) return;
      
  		var x = 0;
  		var y = 0;
  		var w = 0;
  		var e = 0;
  		
  		var h = Math.round(self.boxHeight * scaler);
      
  		if (h < self.boxHeightMin) h = self.boxHeightMin;
  		if (h > self.boxHeightMax) h = self.boxHeightMax;
  		
  		//JS will be too slow if too many divs are being drawn - use an array and innerHTML instead
  		//create div we can use to alter innerHTML
      var containerDiv = document.createElement('DIV');
      containerDiv.style.width = width+"px";
      containerDiv.style.height = height+"px";
      containerDiv.style.left = "0px";
      containerDiv.style.top = "0px";
      containerDiv.style.position = "absolute";
      container.appendChild(containerDiv);
      
  		var newDivs = [];
  		
  		Ext.each(data, function(read)
  		{
  			//self.groups.add(read.cls);
  			//if (!self.groups.active(read.cls)) return;
  			//if (read.level > maxLevel) return;
  			//if (read.multi && !self.showMultis) return;

  			w = read.w;
  			//e = read.e;
  			x = flippedX ? width - read.x - read.w : read.x;
  			y = read.level * (h + ((scaler==0) ? 0 : self.boxSpace));
  			y = flippedY ? y : height - 1 - y - h;

  			if (x + w < region.x1 || x > region.x2) return;
  			if (y + h < region.y1 || y > region.y2) return;
        
        if(w>15)
        {
          newDivs.push("<div id="+container.id+"_read_"+read.id+" data-id="+read.id+" style='width: "+w+"px; height: "+h+"px; left: "+x+"px; top: "+y+"px; cursor: pointer; position: absolute;'></div>");
        }
        
  			//Render slightly differently if paired end
        // if (self.pairedEnd)
        // {
        //  self.paintBox(read.cls, x, y, e, h);
        //  self.paintBox(read.cls + '_spacer', x+e, y, w-(2*e), h);
        //  self.paintBox(read.cls, x+w-e, y, e, h);
        // }
        // else
        // {
        //brush.strokeStyle = "rgba(75,75,85,0.8)";
        brush.fillStyle = self.readColor;
  			brush.fillRect(x, y, w, h);
  			//brush.strokeRect(x,y,w,h);
        // }

        if (w > 2 && read.sequence)
        {
         letterize(brush, read.sequence, x, y, w, h, container);
        }
  		});
      
      //Draw the frames
      brush.lineWidth = 1.0;
      Ext.each(self.frameBreaks, function(fb){        
        
        x = Math.round((fb.x1-self.viewport.x1) * self.viewport.pixels / self.viewport.bases);
        if(x%2!=0) x+=1;
        if(x >= region.x1 && x <= region.x2)
        {
          // Draw the Frame break
          brush.fillStyle = "rgba(75,75,85,.8)";
          brush.fillRect(x,0,1,height);
          brush.fillStyle = "rgba(75,75,85,.2)";
          brush.fillRect(x-2,0,1,height);
          // Text background
          brush.fillStyle = "#EEF";
          metrics = brush.measureText(fb.msg)
          brush.fillRect(x+5,1,metrics.width+2,11);
          // Frame msg text
          brush.textAlign = "left";
          brush.fillStyle = "rgba(75,75,85,.9)";
          brush.fillText(fb.msg,x+5,9);
        }
        
        x2 = Math.round((fb.x2-self.viewport.x1) * self.viewport.pixels / self.viewport.bases);
        if(x2 >= region.x1 && x2 <= region.x2)
        {
          // Text Background
          metrics = brush.measureText(fb.msg)
          brush.fillStyle = "#EEF";
          brush.fillRect((x2-metrics.width)-5,1,metrics.width+2,11);
          // Frame msg text
          brush.fillStyle = "rgba(75,75,85,.9)";
          brush.textAlign = "right"          
          brush.fillText(fb.msg,x2-5, 9)
        }
      });
      
      //Append all the html DIVs we created
      containerDiv.innerHTML+=newDivs.join("\n");

      //setup the click event
      for(i=0;i<containerDiv.children.length;i++)
        Ext.get(containerDiv.children[i]).addListener('mouseup', selectItem);
      
  	};
    
    function selectItem(event, srcEl, obj)
		{
			var el = Ext.get(srcEl);
			var pos = self.viewport.x1 + Math.round((self.viewport.bases / self.viewport.pixels) * (event.getX()-Ext.get(self.getContainer()).getX()))
			self.fireEvent('itemSelected', el.dom.getAttribute('data-id'),pos);
		};
		
  	function letterize(brush, sequence, x, y, w, h, container)
  	{
  		//var clean = "";
  		var length = sequence.length;
  		var letterW = self.viewport.pixels/self.viewport.bases;
  		
  		var half = length/2;
  		var readLength = half * letterW;

  		for (var i=0; i<length; i++)
  		{
  			var letter = sequence.charAt(i);
  			
			  if(! self.colorBases){  			    
			    switch (letter)
    			{
  				  case 'A': letter = 'A_trans'; break;
  				  case 'T': letter = 'T_trans'; break;
  				  case 'C': letter = 'C_trans'; break;
  				  case 'G': letter = 'G_trans'; break;
  				  case 'N': letter = 'N_trans'; break;
			    }
			  }
			  
				switch (letter){
  				case '-': letter = 'base_spacer';break;
  				case 'n': letter = 'base_spacer'; break;
  				case 'D': letter = 'base_deletion';break;
  				case 'a': letter = 'A_mis'; break;
  				case 't': letter = 'T_mis'; break;
  				case 'c': letter = 'C_mis'; break;
  				case 'g': letter = 'G_mis'; break;
  			}
  			//clean += letter;

  			var letterX = x + (i * letterW) //+ (i >= half ? w-2*readLength : 0);
  			if ((letterW < 5 || h < self.boxBlingLimit) && letter != 'base_spacer')
  			{
  				if(fs = self.styles.get(letter).fill){
  				  brush.fillStyle = fs;
  				}else{
  				  brush.fillStyle = self.readColor;
  				};
  				
  				brush.fillRect(letterX, y, letterW, h);
  			}
  			else
  			{
  				self.paintBox(letter, letterX, y, letterW, h);
  			}
  		};
  	};
  }
});