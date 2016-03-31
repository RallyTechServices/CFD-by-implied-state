Ext.define("TSCFDByImpliedState", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { 
        margin: 10
    },
    
    config: {
        defaultSettings: {
            metric_field: "Count"
        }
    },
    
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
        var me = this;
        var container = this.down('#display_box');
        container.removeAll();
        
        this.setLoading("Gathering Data...");

        var project = this.getContext().getProject().ObjectID;
        var type_path = this.getSetting('type_path');
        var value_field = this.getSetting('metric_field');
        var period_length = this.getSetting('time_period') || 1;

        var title = "Implied State CFD Over Last " + period_length + " Month(s)";
        var start_date = Rally.util.DateTime.add(new Date(), 'month', -1 * period_length);
                
        container.add({
            xtype:'rallychart',
            storeType: 'Rally.data.lookback.SnapshotStore',
            calculatorType: 'Rally.TechnicalServices.ImpliedCFDCalculator',
            calculatorConfig: {
                startDate: start_date,
                endDate: new Date(),
                value_field: value_field
            },
            storeConfig: {
                filters: [
                    {property:'_TypeHierarchy',value: type_path},
                    {property:'_ProjectHierarchy', value: project}
                ],
                fetch: [value_field,'ActualStartDate','ActualEndDate'],
                removeUnauthorizedSnapshots : true,
                listeners: {
                    load: function() {
                        me.setLoading(false);
                    }
                }
            },
            chartColors : ["#CCCCCC","#00a9e0","#009933"],
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
                     text: title
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
        
        var time_period = this.getSetting('time_period') || 1;
        
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
            model: 'PortfolioItem',
//            handlesEvents: { 
//                select: function(type_picker) {
//                    this.refreshWithNewModelType(type_picker.getValue());
//                },
//                ready: function(type_picker){
//                    this.refreshWithNewModelType(type_picker.getValue());
//                }
//            },
            listeners: {
                ready: function(field_box) {
                    me._addCountToChoices(field_box.getStore());
                    me._filterOutExceptNumbers(field_box.getStore());
                    var value = me.getSetting('metric_field');
                    
                    console.log('value:', value);
                    
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
            name: 'time_period',
            xtype: 'rallycombobox',
            fieldLabel: 'Start',
            labelWidth: 100,
            labelAlign: 'left',
            minWidth: 200,
            margin: 10,
            value: time_period,
            displayField: 'name',
            valueField: 'value',
            store: Ext.create('Rally.data.custom.Store',{
                data: [
                    {name:'A Month Ago', value:1},
                    {name:'3 Months Ago', value:3},
                    {name:'6 Months Ago', value:6},
                    {name:'A Year Ago', value:12 },
                    {name:'3 Years Ago', value:36 }
                ]
            })
        }];
    }
    
});
