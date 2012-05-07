class Tabix < Asset
  def open_tabix(opts={})
    return Bio::Tabix::TFile.open(data.path,opts)
  end
  
  def create_index(opts={})
    #opening the file checks and creates index automatically
    #t = open_tabix
    Bio::Tabix::TFile.build_index(self.data.path,opts)
    #t.close
  end
  
  def get_data(seq,start,stop,opts={})
    start -= 1
    limit = (opts[:limit] || 10000).to_i
    no_limit = opts[:no_limit]
    user_func = opts[:user_func] || (lambda do |s|;s.split("\t");end)
    skip_func = opts[:skip_func] || lambda {|l| false}
    random = Random.new(1024)
    lines = []
    idx = 0
    cnt = 0
    
    fetch_function = lambda do |line, line_length|
      # setup sampling routine
      next if skip_func.call(line)
      unless no_limit
        if lines.size < limit
          idx = cnt
        else
          r = random.rand(cnt+1)
          if(r < limit)
            idx = r
          else
            cnt+=1
            next
          end
        end
      else
        idx = cnt
      end
      # run user supplied parsing
      line = user_func.call(line)
      
      # add the item to the array
      lines[idx] =  line
      cnt +=1
    end
    
    t = open_tabix
    t.process_region(seq,start,stop,fetch_function)
    t.close
    return lines
  end
  
  def groups
    # return list of grouping column values
    t = open_tabix
    g = t.groups
    t.close
    return g
  end
  
  def header
    # return file header
    t = open_tabix
    h = t.header
    t.close
    return h
  end
  
end