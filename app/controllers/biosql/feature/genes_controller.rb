class Biosql::Feature::GenesController < ApplicationController
  authorize_resource :class => "Biosql::Feature::Gene"
  before_filter :get_gene_data, :only => [:edit, :update]
  before_filter :new_gene_data, :only => [:new,:create]
  def index
    redirect_to :seqfeatures
  end
  
  def new
    # Create a gene template for the bioentry
    if @bioentry
      @gene = Biosql::Feature::Gene.new(:bioentry => @bioentry)
      # Add a new gene model
      @gene.gene_models.build
      # Add a locus tag
      @gene.qualifiers.build(:term => Biosql::Term.annotation_tags.where(:name => 'locus_tag').first)
      # Add a location
      @gene.locations.build
    end
  end
  
  def create
    begin
      @gene = Biosql::Feature::Gene.new(params[:biosql_feature_gene])
      @bioentry = @gene.bioentry
      @assembly = @gene.bioentry.assembly if @bioentry
      if(@gene.valid?)
        Biosql::Feature::Gene.transaction do
          @gene.save
          redirect_to seqfeature_path(@gene), :notice => "Gene Created Successfully"
        end
      else
        # add gene model
        @gene.gene_models.build unless @gene.gene_models.length > 0
        # add locus
        @gene.qualifiers.build(:term => Biosql::Term.annotation_tags.where(:name => 'locus_tag').first) unless @gene.locus_tag
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
    # try finding gene by locus
    gene_id = Biosql::Feature::Gene.with_locus_tag(params[:id]).first.try(:id) || params[:id]
    redirect_to seqfeature_path(gene_id)
  end

  def edit
    @format = 'edit'
    authorize! :update, @gene
    @seqfeature = @gene
    if request.xhr?
      setup_xhr_form
      #@seqfeature.qualifiers.build
      render :partial => 'form'
    end
    if @gene.locations.empty?
      @gene.locations.build
    end
  end
  
  def update
    authorize! :update, @gene
    begin
      Biosql::Feature::Gene.transaction do
        if(@gene.update_attributes(params[:biosql_feature_gene]))
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
    authorize! :create, Biosql::Feature::Gene.new
    @assemblies = Assembly.includes(:taxon => :scientific_name).order('taxon_name.name').accessible_by(current_ability)
    @src_terms = Biosql::Term.source_tags
    if params[:bioentry_id]
      @bioentry=Biosql::Bioentry.find_by_bioentry_id(params[:bioentry_id])
      @assembly = @bioentry.assembly
    elsif params[:assembly_id]
      @assembly = Assembly.find_by_id(params[:assembly_id])
      @bioentry = @assembly.bioentries.first if @assembly
    end
  end
  
  def setup_xhr_form
    @skip_locations=@extjs=true
    @blast_reports = @seqfeature.blast_iterations
    @changelogs = @seqfeature.related_versions
  end
  
  def get_gene_data
    begin
      #get gene and attributes
      @gene = Biosql::Feature::Gene.find(params[:id], 
        :include => [
          :locations,
          [
            :bioentry => [:assembly]
          ],[
            :gene_models => [
              :cds => [:locations, [:qualifiers => :term]],
              :mrna => [:locations, [:qualifiers => :term]]
            ]
          ],[
            :qualifiers => :term
          ]
        ]
      )
      @locus = @gene.locus_tag.value.upcase
      @bioentry = @gene.bioentry
      @annotation_terms = Biosql::Term.annotation_tags.order(:name).reject{|t|t.name=='locus_tag'}
      @src_terms = Biosql::Term.source_tags      
      seq_src_ont_id = Biosql::Term.seq_src_ont_id
      @seq_src_term_id = Biosql::Term.default_source_term.id
    rescue => e
      logger.error "\n\n#{$!}\n\n#{e.backtrace.join("\n")}\n\n"
    end
  end
end