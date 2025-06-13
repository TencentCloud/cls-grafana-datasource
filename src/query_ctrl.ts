// import { QueryCtrl } from 'grafana/app/plugins/sdk';

import type { auto } from 'angular';
import _ from 'lodash';

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

    ctrl.target.type = ctrl.panel.type || 'timeserie';
  }

  queryChanged() {
    this.refresh();
  }
}
