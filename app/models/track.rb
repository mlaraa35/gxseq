# == Schema Information
#
# Table name: tracks
#
#  assembly_id    :integer
#  created_at     :datetime
#  sample_id  :integer
#  id             :integer          not null, primary key
#  sample         :string(255)
#  source_term_id :integer
#  type           :string(255)
#  updated_at     :datetime
#

class Track < ActiveRecord::Base
  belongs_to :assembly
  belongs_to :sample
  has_many :track_configurations, :dependent => :destroy

  def name
    'Generic Track'
  end
  # creates tracks for all database items.
  # returns total number of tracks in database
  def self.create_all
    Sample.all.each do |sample|
      sample.create_tracks
    end
    Assembly.all.each do |assembly|
      assembly.create_tracks
    end
    return Track.count
  end
  
  def root_path
    ENV['RAILS_RELATIVE_URL_ROOT']
  end
  
  # def custom_config
  #   ""
  # end
  
  def base_config
    {
      :id => id,
      :name => name,
      :type => track_type,
      :data => data_path,
      :iconCls => iconCls,
      :height => default_height,
      :details => detail_text,
      :description => description_text
    }
  end
  
  # def type
  #   "type     : '#{self.class.name}',"
  # end
  
  def default_height
    100
  end
  
  def name
    sample.name.gsub("\\","\\\\\\\\").gsub("'",%q(\\\'))
  end

  def iconCls
    'silk_bricks'
  end
  
  def track_type
    self.class.name
  end
  
  def data_path
  end
  
  def detail_text
    "Not Provided"
  end
  
  def description_text
    "Not Provided"
  end
  
end

