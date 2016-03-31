Ext.define("Rally.TechnicalServices.ImpliedCFDCalculator", {
    extend: "Rally.data.lookback.calculator.TimeSeriesCalculator",

    config: {
        /*
         * Name of field that holds the value to add up
         * (Required if type is "sum")
         */
        value_field: null, 
        granularity: 'day',
        /*
         * value_type: 'sum' | 'count' whether to count on given field or to count the records
         */
        value_type: 'sum',
        endDate: null,
        startDate: null,
        
        stateDisplayNames: ['Not Started','In Progress','Done'],
        
        stateDisplayFunction: function(snapshot) {            
            if ( Ext.isEmpty(snapshot.ActualStartDate) ) {
                return this.stateDisplayNames[2];
            }
            
            if ( Ext.isEmpty(snapshot.ActualEndDate) ) {
                return this.stateDisplayNames[1];
            }
            
            return this.stateDisplayNames[0]
        }
    },
    constructor: function (config) {
        this.callParent(arguments);

        if (this.value_field == 'Count'){
            this.value_type = 'count';
        }

        if (this.value_type == 'sum' && !this.value_field) {
            throw "Cannot create Rally.TechnicalServices.ImpliedCFDCalculator by sum without value_field";
        }
        
        this._prepareDates();
        
    },
    /*
     * The goal is to have two dates, in order, that are ISO strings
     */
    _prepareDates: function() {
        if ( this.startDate == "" ) { this.startDate = null; }
        if ( this.endDate == "" )   { this.endDate   = null; }
        
        if ( this.startDate && typeof(this.startDate) === 'object' ) {
            this.startDate = Rally.util.DateTime.toIsoString(this.startDate);
        }
        if ( this.endDate && typeof(this.endDate) === 'object' ) {
            this.endDate = Rally.util.DateTime.toIsoString(this.endDate);
        }
        
        if ( this.startDate && ! /-/.test(this.startDate)  ){
            console.log(this.startDate);
            throw "Failed to create Rally.TechnicalServices.ImpliedCFDCalculator: startDate must be a javascript date or ISO date string";
        }

        if ( this.endDate && ! /-/.test(this.endDate)  ){
            console.log(this.endDate);
            throw "Failed to create Rally.TechnicalServices.ImpliedCFDCalculator: endDate must be a javascript date or ISO date string";
        }
    
        // switch dates
        if ( this.startDate && this.endDate ) {
            if ( this.startDate > this.endDate ) {
                var holder = this.startDate;
                this.startDate = this.endDate;
                this.endDate = holder;
            }
        }
        
        if ( this.startDate ) { this.startDate = this.startDate.replace(/T.*$/,""); }
        if ( this.endDate ) { this.endDate = this.endDate.replace(/T.*$/,""); }
    },
    /*
     * How to measure
     * 
     * { 
     *      field       : the field that has the value to add up on each day
     *      as          : the name to display in the legend
     *      display     : "line" | "column" | "area"
     *      f           : function to use (e.g., "sum", "filteredSum"
     *      filterField : (when f=filteredSum) field with values used to group by (stacks on column)
     *      filterValues: (when f=filteredSum) used to decide which values of filterField to show
     */
    getMetrics: function () {
        
        var metric = {
            f: 'groupBySum',
            field: this.value_field, 
            groupByField: '__ImpliedState', 
            allowedValues: this.stateDisplayNames,
            display:'area'
        };
                
        if ( this.value_type == "count" ) {
            metric.f = 'groupByCount';
        }
        
        return [ metric ];
    },
    
    getDerivedFieldsOnInput: function() {
        var me = this;
        return [
            { 
                as: '__ImpliedState',
                f : function(snapshot) {
                    return me.stateDisplayFunction(snapshot);
                }
            }
        ];
    },
    
    /*
     * Modified to allow groupBySum/groupByCount to spit out stacked area configs
     */
    _buildSeriesConfig: function (calculatorConfig) {
        var aggregationConfig = [],
            metrics = calculatorConfig.metrics,
            derivedFieldsAfterSummary = calculatorConfig.deriveFieldsAfterSummary;

        for (var i = 0, ilength = metrics.length; i < ilength; i += 1) {
            var metric = metrics[i];
            if ( metric.f == "groupBySum" || metric.f == "groupByCount") {
                var type = metric.f.replace(/groupBy/,"");
                
                Ext.Array.each(metric.allowedValues,function(allowed_value){
                    aggregationConfig.push({
                        f: type,
                        name: allowed_value,
                        type: metric.display || "area",
                        dashStyle: metric.dashStyle || "Solid",
                        stack: 1
                    });
                });
            } else {
                aggregationConfig.push({
                    name: metric.as || metric.field,
                    type: metric.display,
                    dashStyle: metric.dashStyle || "Solid"
                });
            }
        }

        for (var j = 0, jlength = derivedFieldsAfterSummary.length; j < jlength; j += 1) {
            var derivedField = derivedFieldsAfterSummary[j];
            aggregationConfig.push({
                name: derivedField.as,
                type: derivedField.display,
                dashStyle: derivedField.dashStyle || "Solid"
            });
        }

        return aggregationConfig;
    },
    /*
     * WSAPI will give us allowed values that include "", but the
     * snapshot will actually say null
     * 
     */
    _convertNullToBlank:function(snapshots){
        var number_of_snapshots = snapshots.length;
        for ( var i=0;i<number_of_snapshots;i++ ) {
            if ( snapshots[i][this.group_by_field] === null ) {
                snapshots[i][this.group_by_field] = "";
            }
        }
        return snapshots;
    },
//    _getAllowedSnapshots:function(snapshots){
//        var allowed_snapshots = [];
//        var allowed_oids = this.allowed_oids;
//        
//        if ( allowed_oids.length === 0 ) {
//            return [];
//        }
//        var number_of_snapshots = snapshots.length;
//        for ( var i=0;i<number_of_snapshots;i++ ) {
//            if (Ext.Array.contains(allowed_oids,snapshots[i].ObjectID)) {
//                allowed_snapshots.push(snapshots[i]);
//            }
//        }
//        return allowed_snapshots;
//    },
    // override runCalculation to change false to "false" because highcharts doesn't like it
    runCalculation: function (snapshots) {
        var calculatorConfig = this._prepareCalculatorConfig(),
            seriesConfig = this._buildSeriesConfig(calculatorConfig);

        var calculator = this.prepareCalculator(calculatorConfig);
        
        var clean_snapshots = this._convertNullToBlank(snapshots);
//        if (this.allowed_oids !== null) {
//            clean_snapshots = this._getAllowedSnapshots(clean_snapshots);
//        }
        if ( clean_snapshots.length > 0 ) {
            calculator.addSnapshots(clean_snapshots, this._getStartDate(clean_snapshots), this._getEndDate(clean_snapshots));
        }
        var chart_data = this._transformLumenizeDataToHighchartsSeries(calculator, seriesConfig);
        
        // check for false
        Ext.Array.each(chart_data.series,function(series){
            if ( series.name === "" ) {
                series.name = "None";
            }
            
            if (series.name === false) {
                series.name = "False";
            }
            
            if (series.name == true) {
                series.name = "True";
            }
        });
        
        return chart_data;
    }
        
        
});