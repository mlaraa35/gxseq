class ExperimentsController < ApplicationController
  
  def asset_details
    begin
      if((params[:exp_id] && @experiment = Experiment.find(params[:exp_id])) || (params[:id] && @experiment = Experiment.find(params[:id])))
        if(asset = @experiment.big_wig)
          render :partial => "assets/big_wig_details", :locals => {:asset => asset}
        else
          render :text => "<span style='color:red;'>No Big Wig found!</span>"
        end
      else
        render :text => "No experiment Found!?"
      end
    rescue
      logger.info "\n\nError in experiemnt asset details #{$!}\n\n"
      render :text => "<span style='color:red;'>Error looking up experiment assets</span>"
    end
  end
  
  def index
    @experiments = Experiment.all
  end

  def new
    @experiment = Experiment.new()
    @bioentries = Bioentry.find(:all, :order => "name asc")
  end

  def create
    @experiment = params[:experiment][:type].constantize.new(params[:experiment])
    if @experiment.valid?
       @experiment.save
       redirect_to @experiment
    else
       @bioentries = Bioentry.all
       render :action => :new
    end
  end

  def show
    @experiment = Experiment.find(params[:id])
  end

  def edit
    @experiment = Experiment.find(params[:id])
    @bioentries = Bioentry.all
  end

  def update
    @experiment = Experiment.find(params[:id])
    if @experiment.update_attributes(params[:experiment])
      flash[:notice] = 'Experiment was successfully updated.'
      redirect_to(@experiment)
    else
      render :action => "edit"
    end
  end  
end