class ChipSeq < Experiment
  has_many :histogram_tracks, :foreign_key => "experiment_id", :dependent => :destroy
  has_one :big_wig, :foreign_key => "experiment_id"
  has_one :wig, :foreign_key => "experiment_id"
  after_save :set_abs_max, :on => :update
  has_peaks
  smoothable
  
  ##Specialized Methods
  def asset_types
    {"bigWig" => "BigWig", "wig" => "Wig"}
  end  
  
  def load_asset_data
    # check for big_wig, create it if missing
    self.update_attribute(:state,"saving")
    create_big_wig_from_wig unless self.big_wig
    self.update_attribute(:state,"ready")
  end
  
  # do nothing don't even destroy the big_wig we create
  def remove_asset_data
  end

  def create_tracks
    self.bioentries_experiments.each do |be|
      histogram_tracks.create(:bioentry => be.bioentry) unless histogram_tracks.any?{|t| t.bioentry_id == be.bioentry_id}
    end
  end

  def summary_data(start,stop,num,chrom)
    self.big_wig ? big_wig.summary_data(start,stop,num,chrom).map(&:to_f) : []
  end

  ##Track Config
  def iconCls
    "chip_seq_track"
  end

  def single
    "true"
  end

  ##Class Specific
  def max(chrom='')
    begin
      big_wig.max(chrom)
    rescue
      1
    end
  end

  def set_abs_max
    bioentries_experiments.each do |be|
      be.update_attribute(:abs_max, self.max(be.sequence_name)) rescue (logger.info "\n\nError Setting abs_max for experiment: #{self.inspect}\n\n")
    end
  end

end

# == Schema Information
#
# Table name: experiments
#
#  id          :integer(38)     not null, primary key
#  bioentry_id :integer(38)
#  user_id     :integer(38)
#  name        :string(255)
#  type        :string(255)
#  description :string(255)
#  file_name   :string(255)
#  a_op        :string(255)
#  b_op        :string(255)
#  mid_op      :string(255)
#  created_at  :datetime
#  updated_at  :datetime
#  creator_id  :integer(38)
#  updater_id  :integer(38)
#  abs_max     :string(255)
#
