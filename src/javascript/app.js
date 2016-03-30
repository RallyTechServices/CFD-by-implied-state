Ext.define("TSCFDByImpliedState", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'display_box'}
    ],

    integrationHeaders : {
        name : "TSCFDByImpliedState"
    },
                        
    launch: function() {
       if ( ! this.getSetting('type_path') ) {
            this.down('#display_box').add({
                xtype:'container',
                html:'No settings applied.  Select "Edit App Settings." from the gear menu.'
            });
            return;
        }
        
        this._makeChart();
    },
    
    _makeChart: function() {
        var container = this.down('#display_box');
        container.removeAll();

        var project = this.getContext().getProject().ObjectID;
        var type_path = this.getSetting('type_path');

        var start_date = this.getSetting('start_date');
        var end_date = this.getSetting('end_date');
        
        var value_field = this.getSetting('metric_field');
        
        container.add({
            xtype:'rallychart',
            storeType: 'Rally.data.lookback.SnapshotStore',
            calculatorType: 'Rally.TechnicalServices.ImpliedCFDCalculator',
            calculatorConfig: {
                startDate: start_date,
                endDate: end_date,
                value_field: value_field
            },
            storeConfig: {
                filters: [
                    {property:'_TypeHierarchy',value: type_path},
                    {property:'_ProjectHierarchy', value: project}
                ],
                fetch: [value_field,'ActualStartDate','ActualEndDate'],
                removeUnauthorizedSnapshots : true
            },
            chartConfig: {
                 chart: {
                     zoomType: 'xy',
                     //height: height,
                     events: {
                        redraw: function () {
//                            me.logger.log('howdy');
//                            me._preProcess();
                        }
                     }
                 },
                 title: {
                     text: 'Implied State CFD'
                 },
                 xAxis: {
                     tickmarkPlacement: 'on',
                     tickInterval: 30,
                     title: {
                         text: ''
                     }
                 },
                 yAxis: [
                     {
                         title: {
                             text: value_field
                         }
                     }
                 ],
                 plotOptions: {
                    series: {
                        marker: { enabled: false },
                        stacking: 'normal'
                    }
                }
            }
        });
    },
      
    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        this.logger.log("Starting load:",config.model);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    _loadAStoreWithAPromise: function(model_name, model_fields){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        this.logger.log("Starting load:",model_name,model_fields);
          
        Ext.create('Rally.data.wsapi.Store', {
            model: model_name,
            fetch: model_fields
        }).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(this);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    
    _displayGrid: function(store,field_names){
        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            columnCfgs: field_names
        });
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        this.launch();
    },
    
    _addCountToChoices: function(store){
        store.add({name:'Count',value:'Count',fieldDefinition:{}});
    },
    
    _filterOutExceptNumbers: function(store) {
        store.filter([{
            filterFn:function(field){ 
                var field_name = field.get('name');

                if ( field_name == 'Formatted ID' || field_name == 'Object ID' ) {
                    return false;
                }
                if ( field_name == 'Latest Discussion Age In Minutes' ) {
                    return false;
                }
                
                if ( field_name == 'Count' ) { return true; }
                
                var attribute_definition = field.get('fieldDefinition').attributeDefinition;
                var attribute_type = null;
                if ( attribute_definition ) {
                    attribute_type = attribute_definition.AttributeType;
                }
                if (  attribute_type == "QUANTITY" || attribute_type == "INTEGER" || attribute_type == "DECIMAL" ) {
                    return true;
                }

                return false;
            } 
        }]);
    },
    
    getSettingsFields: function() {
        var me = this;
        
        return [
        {
            name: 'type_path',
            xtype:'rallycombobox',
            displayField: 'DisplayName',
            fieldLabel: 'Artifact Type',
            autoExpand: true,
            storeConfig: {
                model:'TypeDefinition',
                filters: [
                    {property:'TypePath',operator:'contains', value:'PortfolioItem/'}
                ]
            },
            labelWidth: 100,
            labelAlign: 'left',
            minWidth: 200,
            margin: 10,
            valueField:'TypePath',
            bubbleEvents: ['select','ready'],
            readyEvent: 'ready'
        },
        {
            name: 'metric_field',
            xtype: 'rallyfieldcombobox',
            fieldLabel: 'Measure',
            labelWidth: 100,
            labelAlign: 'left',
            minWidth: 200,
            margin: 10,
            autoExpand: false,
            alwaysExpanded: false,
            handlesEvents: { 
                select: function(type_picker) {
                    this.refreshWithNewModelType(type_picker.getValue());
                },
                ready: function(type_picker){
                    this.refreshWithNewModelType(type_picker.getValue());
                }
            },
            listeners: {
                ready: function(field_box) {
                    me._addCountToChoices(field_box.getStore());
                    me._filterOutExceptNumbers(field_box.getStore());
                    var value = me.getSetting('metric_field');
                    if ( value ) {
                        field_box.setValue(value);
                    }
                    if ( !field_box.getValue() ) {
                        field_box.setValue( field_box.getStore().getAt(0) );
                    }
                }
            },
            readyEvent: 'ready'
        },
        {
            name: 'start_date',
            xtype: 'rallydatefield',
            fieldLabel: 'Start Date',
            labelWidth: 100,
            labelAlign: 'left',
            minWidth: 200,
            margin: 10
        },
        {
            name: 'end_date',
            xtype: 'rallydatefield',
            fieldLabel: 'End Date',
            labelWidth: 100,
            labelAlign: 'left',
            minWidth: 200,
            margin: 10
        }];
    }
    
});
