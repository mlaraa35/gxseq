# == Schema Information
#
# Table name: samples
#
#  a_op               :string(255)
#  assembly_id        :integer
#  b_op               :string(255)
#  concordance_set_id :integer
#  created_at         :datetime
#  description        :string(2000)
#  file_name          :string(255)
#  group_id           :integer
#  id                 :integer          not null, primary key
#  mid_op             :string(255)
#  name               :string(255)
#  sequence_name      :string(255)
#  show_negative      :string(255)
#  state              :string(255)
#  total_count        :integer
#  type               :string(255)
#  updated_at         :datetime
#  user_id            :integer
#

class Variant < Sample
  has_many :variant_tracks, :foreign_key => "sample_id", :dependent => :destroy
  has_one :bcf, :foreign_key => "sample_id"
  has_one :vcf, :foreign_key => "sample_id"
  has_one :tabix_vcf, :foreign_key => "sample_id"
  
  def asset_types
    {"vcf" => "Vcf", "tabix-vcf" => "TabixVcf", "bcf" => "Bcf"}
  end  
  
  def load_asset_data
    return false unless super
    begin
      if(vcf && !tabix_vcf)
        self.create_tabix_vcf(:data => vcf.create_tabix_vcf)
        tabix_vcf.load
      end
      # create the tracks again after we are done loading
      # the first attempt fails because we don't know what samples to use
      create_tracks
      return true
    rescue
      puts "Error loading Variant assets:\n#{$!}"
      return false
    end
  end
  # creates 1 track for each sample in the vcf and attaches them to the bioentry
  # TODO: convert variant_track in js to multiple samples, then we can remove 'tracks' concept entirely
  # NOTE: May want to have one variant and one reads_track for Re-Seq samples. Maybe have Sample create multiple configs..
  def create_tracks
    self.samples.each do |samp|
      VariantTrack.find_or_create_by_assembly_id_and_sample_id_and_genotype_sample(assembly_id,self.id,samp)
    end
  end
  # returns the samples from tabix_vcf or bcf or an empty array
  def samples
    begin
      Array( (tabix_vcf || bcf).samples )
    rescue
      []
    end
  end
  # returns the data from tabix_vcf or bcf or an empty array
  # TODO: conver to summary_data for consistency and document asset methods
  def get_data(seq,start,stop,opts={})
  begin
    (tabix_vcf||bcf).get_data(seq,start,stop,opts)
  rescue 
    []
  end
  end
  
  def find_variants(seq,pos)
    begin
      get_data(seq,pos,pos,{:raw => true})
    rescue []
    end
  end
  
  # Method for searching other variants within a region for matching sequence
  # this method does NOT sanitize the positions or id
  def find_matches(start_pos, end_pos, bioentry_id, sample=nil)
    # an array to hold the results
    matching_variants = []
    # store this sample's converted sequence
    this_sequence = self.get_sequence(start_pos,end_pos,bioentry_id,sample)
    # grab all of the variant samples
    (assembly.variants-[self]).each do |variant|
      # compute the variant sequence, compare to self and store if equal
      matching_variants << variant if  this_sequence == variant.get_sequence(start_pos,end_pos,bioentry_id,sample)
    end
    return matching_variants
  end
  
  # Method for returning altered base sequence using a window to apply sequence_variant diffs
  # This represents the strain/variant sequence in the given window
  # 
  def get_sequence(start,stop,bioentry_id,sample=nil,opts={})
    color_html = opts[:html]
    bioentry = Biosql::Bioentry.find_by_bioentry_id(bioentry_id)
    return false unless bioentry
    #check boundaries
    start = 0 unless start >=0
    stop = bioentry.length unless stop <= bioentry.length
    #storing the deletion/insertion changes
    offset = 0
    #storing the possible alt alleles
    alleles = []
    #Get the sequence_variants within start and stop on given entry
    c_item = self.concordance_items.find_by_bioentry_id(bioentry_id)
    usable_variants = self.get_data(c_item.reference_name,start,stop,{:sample => sample,:only_variants => true}).reject{|a| a[:allele] != 1}.sort{|a,b|a[:pos]<=>b[:pos]}
    #Convert seq to array of indiv. bases
    seq_slice = bioentry.biosequence_without_seq.get_seq(start-1,(stop-start)+1)
    if(seq_slice && seq_slice.length >=0)
      seq_a = seq_slice.split("")
      if(color_html)
        seq_a.collect!{|s|"<span style='background:whitesmoke;'>#{s}</span>"}
      end
    else
      return ""
    end
    #Apply the changes
    usable_variants.each_with_index do |v,idx|
      #setup alternate sequence
      # if(usable_variants[idx+1] && usable_variants[idx+1][:pos] == v[:pos])
      #   #next variant has same position (multiple alleles)
      #   alleles << v[:alt]
      #   next      
      # elsif(alleles.size > 0)
      #   #we have previous alleles indicating this is the last in the series
      #   alleles << v[:alt]
      #   #get the IUB Code for the ambiguous nucleotide
      #   alt = Variant::TO_IUB_CODE[alleles.sort]
      #   #clear out the alleles list
      #   alleles=[]        
      # else
        #just a standard variant
        alt = v[:alt]
      #end      
      alt_size = (v[:alt].nil? ? 0 : v[:alt].size)
      ref_size = (v[:ref].nil? ? 0 : v[:ref].size)
      #get the array index for this variant
      p = ((v[:pos])-start)+offset
      #convert ref seq to alt seq
      if(color_html)
        if alt_size < ref_size
          # deletion
          a = (alt||'').split("").collect{|s|"<span title='Deletion&nbsp;-&nbsp;Ref:&nbsp;#{v[:ref]}&nbsp;Alt:&nbsp;#{v[:alt]}'style='background:salmon;'>#{s}</span>"}
        elsif alt_size > ref_size
          # insertion
          a = (alt||'').split("").collect{|s|"<span title='Insertion&nbsp;-&nbsp;Ref:&nbsp;#{v[:ref]}&nbsp;Alt:&nbsp;#{v[:alt]}'style='background:lightgreen;'>#{s}</span>"}
        elsif alt_size == ref_size
          # snp
          a = (alt||'').split("").collect{|s|"<span title='Snp&nbsp;-&nbsp;Ref:&nbsp;#{v[:ref]}&nbsp;Alt:&nbsp;#{v[:alt]}'style='background:lightblue;'>#{s}</span>"}
        end
        seq_a[p,v[:ref].size]=a
      else
        seq_a[p,v[:ref].size]=(alt.nil? ? [] : alt.split(""))
      end
      #update the offset
      offset +=(alt_size - ref_size)
    end
    #convert the array back to a string
    return seq_a.join("")
  end
  
  #For conversion from SNP using IUB codes
  TO_IUB_CODE =	{
    ['A'] => 'A',
    ['C'] => 'C',
    ['T'] => 'T',
    ['G'] => 'G',
    ['A','C'] => 'M', 
    ['G','T'] => 'K',
    ['C','T'] => 'Y', 
    ['A','G'] => 'R', 
    ['A','T'] => 'W', 
    ['G','C']   => 'S',
    ['A','G','T'] => 'D',
    ['C','G','T'] => 'B',
    ['A','C','T'] => 'H',
    ['A','C','G'] => 'V',
    ['A','C','G','T'] => 'N'
  }
  
  IUB_CODE = {
    'A' => ['A'],
    'C' => ['C'],
    'T' => ['T'],
    'G' => ['G'],
    'M' => ['A','C'], 
    'K' => ['G','T'], 
    'Y' => ['C','T'], 
    'R' => ['A','G'], 
    'W' => ['A','T'], 
    'S' => ['G','C'],   
    'D' => ['A','G','T'], 
    'B' => ['C','G','T'],
    'H' => ['A','C','T'],
    'V' => ['A','C','G'],
    'N' => ['A','C','G','T'] 
  }
    

end
