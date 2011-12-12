GenomeSuite::Application.routes.draw do

  # The priority is based upon order of creation:
  # first created -> highest priority.

  ##Navigation
  #root :to => "home#index"
  root :to => "home#index"
  match '/faq' => 'help#faq', :as  => :faq
  match '/about' => 'help#about', :as  => :about
  match '/help' => 'help#index', :as  => :help
  match '/contact' => 'help#contact', :as  => :contact
  match 'sitemap' => 'help#sitemap', :as => :sitemap

  ##genome
  resources :bioentries do 
    get 'tracks'
  end
  resources :genes do
    get 'details', :on => :collection
  end
  resources :gene_models  
  resources :locations
  resources :seqfeature_qualifier_values
  resources :taxon_versions
  
  ##Browser
  resources :track_layouts
  resources :tracks
  match "fetchers/metadata"
  match "fetchers/base_counts"
  match "fetchers/gene_models"
  match "fetchers/genome"  
  match "generic_feature/gene_models"
  match "protein_sequence/genome"
  
  ##Experiments
  resources :assets, :only => [:show]
  resources :chip_chips do
    get 'details', :on => :collection
    get 'compute_peaks', :on => :member
    member do
      get 'initialize_experiment'
      get 'graphics'
    end
  end
  resources :chip_seqs do
    get 'details', :on => :collection
    get 'compute_peaks', :on => :member
    member do
      get 'initialize_experiment'
      get 'graphics'
    end
  end
  resources :experiments do
    get 'asset_details', :on => :collection
  end
  resources :synthetics do
    get 'details', :on => :collection
    get 'compute_peaks', :on => :member
    member do
      get 'initialize_experiment'
      get 'graphics'
    end
  end
  resources :tools do
    collection do
      get 'details'
      get 'smooth'
      post 'smooth'
      get 'variant_genes'
      post 'variant_genes'
    end
  end
  
  resources :variants do
    collection do
      get 'details'
      get 'track_data'
      post 'reload_assets'
    end
    member do
      get 'initialize_experiment'
      get 'graphics'
    end
  end
  
  ##Accounts
  devise_for :users
  resources :user, :controller => 'user' do
    post 'update_track_node', :on => :member
  end
  
  namespace :admin do
    root :controller => "admin", :action => "index"
    resources :users
    resources :roles
  end
end
