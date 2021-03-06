/*
 * Class for displaying sequence variance as non-overlapping boxes. Shows sequence when zoomed in close
 */
Ext.define('Sv.painters.VariantsCanvas',{
    extend: 'Sv.painters.BoxesCanvas',
		boxHeight : 15,
		boxHeightMax : 24,
		boxHeightMin : 1,
		boxBlingLimit : 5,
		boxSpace : 4,
		initComponent : function(){
			this.callParent(arguments);
			var self = this;
			var data = [];
			var max = 2;
			self.addEvents({
				'itemSelected' : true
			});
      
      this.setMax = function(m)
      {
        //return the new height we want for rendering
				max = m;
      };
      
			//Set the data for this histogram from an array of points
			this.setData = function(items)
			{
				if (!(items instanceof Array)) return;

				Ext.each(items, function(item)
				{
					self.groups.add(item.cls);
				});
				data = items;
			};

			//Draw points using a specified rendering class
			this.paint = function()
			{
				this.clear();
        var brush = this.getBrush();
        var width = this.getWidth();
				var height = this.getHeight();
        //Draw midline
				brush.strokeStyle="rgb(100,100,100)"
        brush.beginPath();
        brush.moveTo(0,height/2);
        brush.lineTo(width,height/2);
				brush.closePath();
        brush.stroke();
        
				if (!data || data.length == 0) return;
				var container = this.getContainer();
				var canvas = this.getCanvas();
				var region = this.getRegion();

				
				var scaler = this.getScaler();
				var x = 0;
				var y = 0;
				var w = 0;
				var h = Math.round(self.boxHeight * scaler);
				if (h < self.boxHeightMin) h = self.boxHeightMin;
				if (h > self.boxHeightMax) h = self.boxHeightMax;

				//Div we can use to alter innerHTML
		        var containerDiv = document.createElement('DIV');
		        containerDiv.style.width = width+"px";
		        containerDiv.style.height = height+"px";
		        containerDiv.style.left = "0px";
		        containerDiv.style.top = "0px";
		        containerDiv.style.position = "absolute";
		        container.appendChild(containerDiv);

				//Levelize the data and get the max visible level (used for a shortcut later)
				//var maxLevel = Math.ceil(region.y2 / (h + self.boxSpace));
				
				

        
				var newDivs = [];
				Ext.each(data, function(variant)
				{
					self.groups.add(variant.cls);
					if (!self.groups.active(variant.cls)) return;
					//if (variant.level > maxLevel) return;

					w = variant.w;
					x = variant.x;
					if(variant.allele == "2"){
            y =(variant.level) * (h+self.boxSpace)
		        //y = 0//h+self.boxSpace
		      }else{
            y = height-(variant.level * (h + self.boxSpace))-h;
					  //y = height-(h + self.boxSpace);
				  }
					if (x + w < region.x1 || x > region.x2) return;
					if (y + h < region.y1 || y > region.y2) return;

		      self.paintBox(variant.cls, x, y, w, h);		      
		      
					  
          if(w > 2)
          {
				    if(variant.cls == 'insertion')
            {
              // get the insertion pos
              if(variant.seq.length % 2 != 0)
              {
                var pos = (x+(w/2)) - (AnnoJ.bases2pixels(1) / 2)
              }else{
                var pos = (x+(w/2))
              }
              // draw the insertion point
              brush.strokeStyle="rgb(100,100,100)"
              brush.beginPath();
              brush.moveTo(pos-3,y);
              brush.lineTo(pos,y-3);
              brush.lineTo(pos+3,y);
              brush.closePath();
              brush.stroke();
            }
            if (variant.seq)
            {
              if(variant.cls =='match')
              { brush.fillStyle="rgb(100,100,100)"
                //brush.font= 20+"px courier"
                brush.fillText(".",x,y+h,w)
                //brush.fillRect(x,y,w,y+h)
               // brush.fillText(variant.seq,x,y+(h-3),w)
              }else{
                letterize(brush, variant.seq, x, y, w, h, container,variant.cls);
              }              
            }
            if((w>=3 && variant.cls != 'match') || w > 10)
  					{
              newDivs.push("<div id=seq_variant_"+variant.id+" data-pos="+variant.pos+" style='width: "+w+"px; height: "+h+"px; left: "+x+"px; top: "+y+"px; cursor: pointer; position: absolute;'></div>");
            }
          }
				});
				//Append all the html DIVs we created
		        containerDiv.innerHTML+=newDivs.join("\n");
		        //setup the click event
		        for(i=0;i<containerDiv.children.length;i++)
		           Ext.get(containerDiv.children[i]).addListener('mouseup', selectItem);
         //return the new height we want for rendering
 				return((h+self.boxSpace)*(max+1)*2);
			};

		    function letterize(brush, sequence, x, y, w, h, container,cls)
		    {
		        //var clean = "";
		        var length = sequence.length;
		        var letterW = AnnoJ.bases2pixels(1);
		        var half = length/2;
		        var readLength = half * letterW;
		        if(letterW > 1 || h < self.boxBlingLimit)
		        {
		            for (var i=0; i<length; i++)
		            {
		                var letter = sequence.charAt(i);

		                var letterX = x + (i * letterW) + (i >= half ? w-2*readLength : 0);

		                brush.fillStyle = '#fff';
		                var oldfont = brush.font;
                    brush.font = 'bold '+(letterW+1)+'px'+' courier new, monospace';
                    brush.fillText(letter,letterX,y+h-1);
                    brush.font = oldfont;

		            };
		        }
		    };

			function selectItem(event, srcEl, obj)
			{
				var el = Ext.get(srcEl);
				self.fireEvent('itemSelected', el.dom.getAttribute('data-pos'));
			};
		}
		
});

