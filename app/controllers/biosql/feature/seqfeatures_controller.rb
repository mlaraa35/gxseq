class Biosql::Feature::SeqfeaturesController < ApplicationController
  before_filter :find_seqfeature, :except => [:index, :new, :create]
  before_filter :get_feature_data, :only => [:edit,:update]
  authorize_resource :class => "Biosql::Feature::Seqfeature"
  # GET /seqfeatures
  def index
    # Defaults
    params[:page]||=1
    params[:c]||='assembly_id'
    order_d = (params[:d]=='down' ? 'desc' : 'asc')
    # Filter setup
    @assemblies = Assembly.accessible_by(current_ability).includes(:taxon => :scientific_name).order('taxon_name.name')
    # Verify Bioentry param
    if params[:assembly_id] && params[:bioentry_id]
      params[:bioentry_id] = nil unless Biosql::Bioentry.find_by_bioentry_id(params[:bioentry_id]).try(:assembly_id) == params[:assembly_id]
    end
    # Grab blast run ids for description
    @blast_run_fields = BlastRun.all.collect{|br| "blast_#{br.id}_text"}
    
    # Find minimum set of id ranges accessible by current user. Set to -1 if no items are found. This will force empty search results
    authorized_id_set = current_ability.authorized_seqfeature_ids
    authorized_id_set=[-1] if authorized_id_set.empty?
    # Begin block
    @search = Biosql::Feature::Seqfeature.search do
      # Auth      
      any_of do |any_s|
        authorized_id_set.each do |id_range|
          any_s.with :id, id_range
        end
      end
      # Text Keywords
      if params[:keywords]
        keywords params[:keywords], :highlight => true
      end
      # Filters
      with :assembly_id, params[:assembly_id] unless params[:assembly_id].blank?
      with :strand, params[:strand] unless params[:strand].blank?
      with(:type_term_id, params[:type_term_id]) unless params[:type_term_id].blank?
      with :bioentry_id, params[:bioentry_id] unless params[:bioentry_id].blank?
      unless params[:start_pos].blank?
        any_of do
          with(:start_pos).greater_than(params[:start_pos])
          with(:end_pos).greater_than(params[:start_pos])
        end
      end
      unless params[:end_pos].blank?
        any_of do
          with(:start_pos).less_than(params[:end_pos])
          with(:end_pos).less_than(params[:end_pos])
        end
      end
      # Sort
      order_by params[:c].to_sym, order_d
      # Paging
      paginate(:page => params[:page], :per_page => 50)
      # scope to id
      # we use this search so we can insert a highlighted text result after an update
      if(params[:seqfeature_id])
        with :id, params[:seqfeature_id]
      end
      # Facets (group counts)
      facet(:type_term_id)
      facet(:strand)
    end
    
    # Check XHR
    # we are assuming all xhr search results with a seqfeature_id are requests for an in place update
    # if there is a result, only render the first
    if params[:seqfeature_id] and request.xhr?
      if @search.total == 0
        render :text => 'not found..'
      else
        @search.each_hit_with_result do |hit,feature|
          render :partial => 'hit_definition', :locals => {:hit => hit, :feature => feature}
          break
        end
      end
    end
    
  end

  # GET /_seqfeatures/1
  def show
    authorize! :read, @seqfeature
    @format = params[:fmt] || 'standard'
    begin
    # Gene features have special show pages
    if @seqfeature.kind_of?(Biosql::Feature::Gene)
      redirect_to gene_path(@seqfeature,:fmt => @format)
    end
    case @format
    when 'standard'
      setup_graphics_data
      @ontologies = Biosql::Term.annotation_ontologies
    when 'genbank'
      #NOTE:  Find related features (by locus tag until we have a parent<->child relationship)
      @features = @seqfeature.find_related_by_locus_tag
      @ontologies = [Biosql::Ontology.find(Biosql::Term.ano_tag_ont_id)]
    when 'history'
      @changelogs = Version.order('id desc').where(:parent_id => @seqfeature.id).where(:parent_type => @seqfeature.class.name)
    when 'expression'
      @feature_counts = get_feature_counts
      setup_graphics_data
    when 'blast'
      @blast_reports = @seqfeature.blast_reports
      params[:blast_report_id]||=@blast_reports.first.id
      @blast_report = BlastReport.find(params[:blast_report_id])
      @blast_run = @blast_report.blast_run
    end
    rescue => e
      server_error(e,"seqfeature show error")
      @seqfeature = nil
    end
  end

  # GET /seqfeatures/new
  def new
  end

  # GET /seqfeatures/1/edit
  def edit
    authorize! :update, @seqfeature
    if request.xhr?
      setup_xhr_form
      #@seqfeature.qualifiers.build
      render :partial => 'form'
    elsif @seqfeature.kind_of?(Biosql::Feature::Gene)
      # Gene features have special edit pages
      redirect_to edit_gene_path(@seqfeature)
    end
    if @seqfeature.locations.empty?
      @seqfeature.locations.build
    end
  end

  # POST /seqfeatures
  def create
    respond_to do |wants|
      if @seqfeature.save
        flash[:notice] = 'Seqfeature was successfully created.'
        wants.html { redirect_to(@seqfeature) }
      else
        wants.html { render :action => "new" }
      end
    end
  end

  # PUT /seqfeatures/1
  def update
    authorize! :update, @seqfeature
    if @seqfeature.update_attributes(params[:seqfeature])
      if request.xhr?
        render :text => "success"
      else
        flash[:notice] = 'Seqfeature was successfully updated.'
        redirect_to edit_seqfeature_path(@seqfeature), :notice => 'Seqfeature was successfully updated.'
      end
    else
      if request.xhr?
        setup_xhr_form
        render :partial => "form"
      else
        render :action => "edit"
      end
    end
  end

  # DELETE /seqfeatures/1
  def destroy
    @seqfeature.destroy
    respond_to do |wants|
      wants.html { redirect_to(params[:return_to]||seqfeatures_url) }
    end
  end
  
  # Custom Routes
  respond_to :json, :only => [:feature_counts,:coexpressed_counts]
  # returns formatted counts for all feature counts tied to seqfeature
  # [{:key => sample_name, :values => {:base => int, :count => float }}, ...]
  def feature_counts
    @feature_counts = get_feature_counts
    data = FeatureCount.create_graph_data(@feature_counts, {:type => (params[:type]||'count')} )
    respond_with data
  end
  # returns formatted counts for all coexpressed features
  #[{:id,:name,:sample1,:sample2,...}]
  def coexpressed_counts
    feature_counts = get_feature_counts
    search = @seqfeature.correlated_search(current_ability,{:per_page => 500})
    respond_with @seqfeature.corr_search_to_matrix(search,feature_counts)
  end
  # Add or Remove this seqfeature as a favorite for the given user, and reindex
  def toggle_favorite
    #Note: is it right to have the image here?
    if favorite_feature = FavoriteSeqfeature.find_by_favorite_item_id_and_user_id(@seqfeature.id,current_user.id)
      favorite_feature.destroy
      @new_favorite_image = 'star_gray.png'
    else
      current_user.seqfeatures << @seqfeature
      @new_favorite_image = 'star.png'
    end
    @seqfeature.index!
  end

  private
    def find_seqfeature
      feature_id = Biosql::Feature::Seqfeature.with_locus_tag(params[:id]).first.try(:id) || params[:id]
      @seqfeature = Biosql::Feature::Seqfeature.where{seqfeature_id == feature_id}.includes(:locations,:qualifiers,[:bioentry => [:assembly]]).first
    end
    # TODO: refactor this method is duplicated from genes_controller
    def get_feature_data
      @format='edit'
      begin
        #get gene and attributes
        @seqfeature = Biosql::Feature::Seqfeature.find(params[:id], :include => [:locations,[:qualifiers => :term],[:bioentry => [:assembly]]])
        setup_graphics_data
        @locus = @seqfeature.locus_tag.value.upcase
        @bioentry = @seqfeature.bioentry
        @annotation_terms = Biosql::Term.annotation_tags.order(:name).reject{|t|t.name=='locus_tag'}
        seq_src_ont_id = Biosql::Term.seq_src_ont_id
        @seq_src_term_id = Biosql::Term.default_source_term.id
      rescue
        logger.error "\n\n#{$!}\n\n#{caller.join("\n")}\n\n"
      end
    end
    
    def get_feature_counts
      @seqfeature.feature_counts
        .accessible_by(current_ability)
        .includes(:experiment)
        .order("experiments.name")
    end
    
    def setup_xhr_form
      @skip_locations=@extjs=true
      @blast_reports = @seqfeature.blast_reports
      @changelogs = Version.order('id desc').where(:parent_id => @seqfeature.id).where(:parent_type => @seqfeature.class.name)
      @changelogs = @changelogs.where{item_type != 'Biosql::Location'}.where{item_type != 'GeneModel'}
    end

    def setup_graphics_data
      @canvas_width = 2500
      @model_height = 15
      @edit_box_height = 320
      min_width = 800
      feature_size = @seqfeature.max_end - @seqfeature.min_start
      @pixels = [(min_width / (feature_size*1.1)).floor,1].max
      @bases = [((feature_size*1.1) / min_width).floor,1].max
      @view_start = @seqfeature.min_start - (feature_size*0.05).floor
      @view_stop = (@seqfeature.min_start+(feature_size*1.05)).ceil
      @graphic_data = Biosql::Feature::Seqfeature.get_track_data(@view_start,@view_stop,@seqfeature.bioentry_id,{:feature => @seqfeature})
      @depth = 3
      @canvas_height = ( @depth * (@model_height * 2))+10 # each model and label plus padding
      @graphic_data=@graphic_data.to_json
    end
end
