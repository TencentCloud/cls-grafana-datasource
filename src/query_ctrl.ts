// import { QueryCtrl } from 'grafana/app/plugins/sdk';

import type { auto } from 'angular';
import _ from 'lodash';

import { PanelDisplayType } from './constant';

export class QueryCtrl {
  target: any;
  datasource: any;
  panelCtrl: any;
  panel: any;
  hasRawMode: boolean;
  error: string;
  isLastQuery: boolean;

  constructor(
    public $scope: any,
    public $injector: auto.IInjectorService,
  ) {
    const { ctrl } = this.$scope;
    ctrl.panel = ctrl.panelCtrl.panel;
    ctrl.isLastQuery = _.indexOf(ctrl.panel.targets, ctrl.target) === ctrl.panel.targets.length - 1;
  }

  refresh() {
    const { ctrl } = this.$scope;
    ctrl.panelCtrl.refresh();
  }
}

export class GenericDatasourceQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);
    const { ctrl } = this.$scope;
    ctrl.target.target = ctrl.target.ycol;

    ctrl.target.panelDisplayType =
      ctrl.target.panelDisplayType || typeMap[ctrl.panel.type] || PanelDisplayType.TimeSeries;

    ctrl.syntaxRuleOptions = [
      { name: 'CQL', value: 1 },
      { name: 'Lucene', value: 0 },
    ];
    ctrl.target.syntaxRule = 1;
    ctrl.panelDisplayTypeOptions = QueryEditorFormatOptions;
  }

  queryChanged() {
    this.refresh();
  }
}

const QueryEditorFormatOptions = [
  { value: PanelDisplayType.TimeSeries, name: 'Graph, Pie, Gauge, Time Series Panel' },
  { value: PanelDisplayType.Table, name: 'Table Panel, Singlestat Panel' },
  { value: PanelDisplayType.Log, name: 'Log Panel' },
];

const typeMap = {
  graph: PanelDisplayType.TimeSeries,
  'grafana-piechart-panel': PanelDisplayType.TimeSeries,
  pie: PanelDisplayType.TimeSeries,
  gauge: PanelDisplayType.TimeSeries,
  graph2: PanelDisplayType.TimeSeries,
  singlestat: PanelDisplayType.Table,
  // bargauge: PanelDisplayType.Table,
  // heatmap: PanelDisplayType.Table,
};
