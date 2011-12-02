var ModelsList = function()
{
	ModelsList.superclass.constructor.call(this);

	var self = this;
	//Parse information coming from the server into the list
	this.parse = function(data, above)
	{
		if (!data || !(data instanceof Array)) return
		Ext.each(data, function(datum)
		{
			var strand = datum[2];
			
			if (above && strand != '+') return;
			if (!above && strand != '-') return;
       	//console.log(datum[1])
			var item = {
				parent 	: datum[0],
				id     	: datum[1],
				strand 	: datum[2],
				cls    	: datum[3],
				x      	: parseInt(datum[4]),
				w      	: parseInt(datum[5]),
				product	: datum[7],
				gene	 	: datum[8],
				oid	 	: datum[9],
				locus_tag: datum[10],
				x2			: parseInt(datum[11])
			};

			if (!item.parent)
			{
				if (!self.exists(item.id))
				{
					var node = self.createNode(item.id, item.x, item.x+item.w, item);				
					self.insert(node);
				}
			}
			else
			{
				var parent = self.getValue(item.parent);

				if (parent)
				{
					if (!parent.children)
					{
						parent.children = {};
					}
					parent.children[item.id] = item;
				}
			}
		});
	};
	
	//Returns a collection of points for use with a histogram canvas
	this.subset2canvas = function(x1, x2, bases, pixels)
	{
		var subset = [];
		var bases = parseInt(bases) || 0;
		var pixels = parseInt(pixels) || 0;
		
		if (!bases || !pixels) return subset;

		self.viewport.update(x1,x2);
    // console.log("updating:"+x1+","+x2)
		self.viewport.apply(function(node)
		{
			if (node.x2 < x1) return true;
			var item = {
				id      	: node.id,
				cls     	: node.value.cls,
				x       	: Math.floor((node.value.x - x1) * pixels / bases),
				w       	: Math.ceil(node.value.w * pixels / bases) || 1,
				x2       	: Math.ceil((node.value.x2 - x1) * pixels / bases) || 1,
				children	: [],
				product 	: node.value.product,
				gene	  	: node.value.gene,
				locus_tag: node.value.locus_tag,
				oid		: node.value.oid
			};
			if (node.value.children)
			{
				for (var id in node.value.children)
				{
					var child = node.value.children[id];

					var cw = Math.ceil(child.w * pixels / bases) || 0;

					if (cw)
					{					
						item.children.push({
							id  : child.id,
							cls : child.cls,
							x   : Math.floor((child.x - x1) * pixels / bases),
							x2  : Math.ceil((child.x2 - x1) * pixels / bases),
							w   : cw
						});
					}
				}
			}
      // console.log("2. model x1 (left):"+x1+" x2 (right):"+x2+" node.value.x:"+node.value.x+" x:"+(node.value.x - x1))
			subset.push(item);
      // console.log(subset)
			return true;
		});
		return subset;
	};
};
Ext.extend(ModelsList,RangeList,{})