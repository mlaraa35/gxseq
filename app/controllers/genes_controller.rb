class GenesController < ApplicationController
  before_filter :get_gene_data, :only => [:edit, :update]
  before_filter :new_gene_data, :only => [:new]
  def index   
    @genes = GeneModel.scoped
    # query string
    unless(params[:q].blank?)
      q = "%#{params[:q].upcase}%"
      # we are matching locus_tag and gene_name with the search
      @genes = @genes.where{ (upper(locus_tag) =~ q) | (upper(gene_name) =~ q)}
    end
    # paging
    unless(params[:paging]=='false')
      page = params[:page] || 1
      per_page = params[:limit] || params[:per_page] || @per_page
      @genes = @genes.paginate(:page => page, :per_page => per_page)
    end
    # sorting - because we display association data we need to sort on association columns
    if(params[:sort] && (sort=JSON.parse(params[:sort])) )
      sort.each do |s|
        if(s['property'] && s['direction'])
          case s['property']
          when 'sequence_name'
            # virtual attribute, not sortable
          when 'sequence_version'
            @genes = @genes.joins{bioentry}.order("bioentry.version #{s['direction']}")
          when 'sequence_taxon'
            @genes = @genes.joins{bioentry.taxon.scientific_name}.order("taxon_name.name #{s['direction']}")
          when 'sequence_species'
            # needs proper 'species' relation, not sortable
            #@genes = @genes.joins{bioentry.taxon.species.scientific_name}.order("taxon_name.name #{s['direction']}")
          else
            @genes = @genes.order("#{s['property']} #{s['direction']}")
          end
        end
      end
    end
    respond_to do |format|
      format.html{}
      format.json {
        render :json => {
          :total_entries => @genes.total_entries,
          :gene_models => @genes.as_api_response(:listing)
        }
      }
    end
  end
  
  def new
    respond_to do |format|
      format.html{}
      format.js{
        if(@gene)
          render :partial => "form"
        elsif(@taxon_version)
          render :partial => "bioentry_form"
        else
          render :text  => "No Data"
        end
      }
    end
  end
  
  def create
    begin
      @taxons = Bioentry.all_taxon
      @taxon_versions = TaxonVersion.order(:name)
      @gene = Gene.new(params[:gene])
      
      @bioentry = @gene.bioentry
      @taxon_version = @gene.bioentry.taxon_version
      @bioentries = @taxon_version.bioentries
      @annotation_terms = Term.annotation_tags.order(:name).reject{|t|t.name=='locus_tag'}
      seq_src_ont_id = Ontology.find_or_create_by_name("SeqFeature Sources").id
      @seq_src_term_id = Term.find_or_create_by_name_and_ontology_id("EMBL/GenBank/SwissProt",seq_src_ont_id).id
      if(@gene.valid?)
        Gene.transaction do
          @gene.save
          redirect_to [:edit,@gene], :notice => "Gene Created Successfully"
        end
      else
        logger.info "\n\n#{@gene.errors.inspect}\n\n"
        flash.now[:warning]="Oops, something wasn't right. Check below..."
        render :new
      end
    rescue
       logger.error("#{$!} #{caller.join("\n")}")
       flash.now[:error]="Error creating Gene"
       render :new
     end
  end
  
  def show
    @format = params[:fmt] || 'standard'
    begin
    case @format
    when 'variants'
      @gene = Gene.find(params[:id])
      @variant_window = [(params[:v_win].to_i || 0),1000].min
      @variant_format = params[:v_fmt] || 'fasta'
    when 'standard'
      # test the id parameter for non numeric characters
      if(params[:id]=~/^\d+$/)
        @gene = Gene.find(params[:id], :include => [:locations,[:bioentry => [:taxon_version]],[:gene_models => [:cds => [:locations, [:qualifiers => :term]],:mrna => [:locations, [:qualifiers => :term]]]],[:qualifiers => :term]])
      else
        @gene = Gene.with_locus_tag(params[:id]).first
      end
      setup_graphics_data
      #check for other genes with the same locus_tag
      @genes = Gene.with_locus_tag( @gene.locus_tag.value)
    when 'genbank'
      @gene = Gene.find(params[:id])
      #Find related features (by locus tag until we have a parent<->child relationship)
      @features = Seqfeature.where(:bioentry_id => @gene.bioentry_id).with_locus_tag(@gene.locus_tag.value)
    when 'history'
      @gene = Gene.find(params[:id])
      @changelogs = Version.order('created_at desc').where(:parent_id => @gene.id).where(:parent_type => 'Gene')
    end
    rescue
      @gene = nil
    end
  end
  
  def edit
  end
  
  def update
    begin
      Gene.transaction do
        if(@gene.update_attributes(params[:gene]))
          redirect_to [:edit,@gene], :notice => "Gene Updated successfully"
        else
          flash.now[:warning]="Oops, something wasn't right. Check below..."
          render :edit
        end
      end
    rescue
      if(@gene)
        logger.error("#{$!} #{caller.join("\n")}")
        flash[:error]="Error updating gene"
        redirect_to [:edit,@gene]
      else
        redirect_to :action => :index
      end
    end
  end
  
  private
  
  def new_gene_data
    @taxon_version = @bioentry = nil
    @taxon_versions = TaxonVersion.order(:name)
    seq_src_ont_id = Ontology.find_or_create_by_name("SeqFeature Sources").id
    @seq_src_term_id = Term.find_or_create_by_name_and_ontology_id("EMBL/GenBank/SwissProt",seq_src_ont_id).id
    begin
    if(params[:taxon_version_id] && @taxon_version = TaxonVersion.find(params[:taxon_version_id]))
      @bioentries = @taxon_version.bioentries
      
      if(params[:bioentry_id]&& @bioentry = Bioentry.find(params[:bioentry_id]))
        @gene = Gene.new(:bioentry_id => @bioentry.id)
        # add the first blank gene model.
        @gene.gene_models.build
        # Add the locus_tag qualifier. This is required for all genes
        q = @gene.qualifiers.build
        q.term = Term.find_by_name('locus_tag')
        q.term_id = q.term.id
        # Add the blank location
        @gene.locations.build
        # get the annotation terms
        @annotation_terms = Term.annotation_tags.order(:name).reject{|t|t.name=='locus_tag'}
        logger.info "\n\n#{@annotation_terms}\n\n"
      end
    else
      @bioentries = []
    end
    rescue
    end
  end
  
  def get_gene_data
    begin
      #get gene and attributes
      @gene = Gene.find(params[:id], :include => [:locations, [:bioentry => [:taxon_version]],[:gene_models => [:cds => [:locations, [:qualifiers => :term]],:mrna => [:locations, [:qualifiers => :term]]]],[:qualifiers => :term]])
      setup_graphics_data      
      @locus = @gene.locus_tag.value.upcase
      @bioentry = @gene.bioentry
      @annotation_terms = Term.annotation_tags.order(:name).reject{|t|t.name=='locus_tag'}      
      seq_src_ont_id = Ontology.find_or_create_by_name("SeqFeature Sources").id
      @seq_src_term_id = Term.find_or_create_by_name_and_ontology_id("EMBL/GenBank/SwissProt",seq_src_ont_id).id
    rescue
      logger.error "\n\n#{$!}\n\n#{caller.join("\n")}\n\n"
    end
  end
  
  def setup_graphics_data
    @canvas_width = 3000
    @model_height = 15
    @edit_box_height = 320
    gene_size = @gene.max_end - @gene.min_start
    @gui_zoom = (gene_size/600).floor + 2    
    @view_start = @gene.min_start - (200*@gui_zoom)
    @gui_data = GeneModel.get_canvas_data(@view_start,@view_start+(@canvas_width*@gui_zoom),@gene.bioentry.id,@gui_zoom,@gene.strand)
    @depth = @gui_data.collect{|g| (g[:x2]>=(@gene.min_start-@view_start)/@gui_zoom && g[:x]<=(@gene.max_end-@view_start)/@gui_zoom) ? 1 : nil}.compact.size
    @canvas_height = ( @depth * (@model_height * 2))+10 # each model and label plus padding
    @gui_data=@gui_data.to_json
  end
  
  
end