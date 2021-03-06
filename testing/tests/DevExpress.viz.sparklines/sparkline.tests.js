"use strict";

/* global currentTest, createTestContainer */

var $ = require("jquery"),
    noop = require("core/utils/common").noop,
    vizMocks = require("../../helpers/vizMocks.js"),
    tooltipModule = require("viz/core/tooltip"),
    BaseWidget = require("viz/core/base_widget"),
    rendererModule = require("viz/core/renderers/renderer"),
    baseThemeManagerModule = require("viz/core/base_theme_manager"),
    dataValidatorModule = require("viz/components/data_validator"),
    translator2DModule = require("viz/translators/translator2d"),
    seriesModule = require("viz/series/base_series"),
    dataSourceModule = require("data/data_source/data_source"),
    themeModule = require("viz/themes");

require("viz/sparkline");

$("<div>")
    .attr("id", "container")
    .css({ width: 250, height: 30 })
    .appendTo("#qunit-fixture");

QUnit.begin(function() {
    var FakeTranslator = vizMocks.stubClass({
            getCanvasVisibleArea: function() { return {}; }
        }),
        StubSeries = vizMocks.Series,
        StubTooltip = vizMocks.Tooltip;

    rendererModule.Renderer = sinon.spy(function() {
        return currentTest().renderer;
    });

    translator2DModule.Translator2D = sinon.spy(function() {
        return currentTest().translator;
    });

    seriesModule.Series = sinon.spy(function() {
        return currentTest().series;
    });

    tooltipModule.Tooltip = sinon.spy(function() {
        return currentTest().tooltip;
    });

    QUnit.testStart(function() {
        translator2DModule.Translator2D.reset();
        rendererModule.Renderer.reset();
        seriesModule.Series.reset();
    });

    var environment = {
        beforeEach: function() {
            this.clock = sinon.useFakeTimers();

            this.$container = createTestContainer('#container');
            this.renderer = new vizMocks.Renderer();
            this.translator = new FakeTranslator();
            this.series = new StubSeries();
            this.tooltip = new StubTooltip();

            this.series.stub("getPoints").returns([{
                argument: 1,
                value: 2,
                correctCoordinates: sinon.stub()
            }]);
        },
        afterEach: function() {
            this.$container.remove();
            this.clock.restore();
        },
        createSparkline: function(options, container, rangeData) {
            container = container || this.$container;

            this.series.type = options.type;
            this.series.stub("getRangeData").returns(rangeData || { arg: {}, val: {} });
            this.series.stub("getArgumentField").returns(options.argumentField || "arg");
            this.series.stub("getValueFields").returns([options.valueField || "val"]);
            this.series.stub("getOptions").returns({});

            return container.dxSparkline(options).dxSparkline("instance");
        },
        forceTimeout: function() {
            this.clock.tick(0);
        },
        getCanvas: function() {
            return translator2DModule.Translator2D.lastCall.args[1];
        },
        getRanges: function() {
            return {
                arg: translator2DModule.Translator2D.firstCall.args[0],
                val: translator2DModule.Translator2D.secondCall.args[0]
            };
        },
        getSeriesOptions: function() {
            return this.series.updateOptions.lastCall.args[0];
        }
    };

    function getEnvironmentWithStubValidateData() {
        return $.extend({}, environment, {
            beforeEach: function() {
                environment.beforeEach.apply(this, arguments);
                this.validateData = sinon.stub(dataValidatorModule, "validateData", function() {
                    return {
                        arg: [{
                            argument: 1,
                            value: 3
                        }]
                    };
                });
            },
            afterEach: function() {
                environment.afterEach.apply(this, arguments);
                this.validateData.restore();
            },
            getData: function() {
                return this.validateData.lastCall.args[0];
            }
        });
    }

    QUnit.module('Canvas', environment);

    QUnit.test('Create canvas when size option is defined', function(assert) {
        this.createSparkline({
            dataSource: [1],
            size: {
                width: 250,
                height: 30
            }
        });
        canvas = this.getCanvas();
        var canvas = this.getCanvas();

        assert.deepEqual(canvas, { width: 250, height: 30, top: 3, bottom: 3, left: 5, right: 5 }, 'Canvas object is correct');
        assert.equal(this.renderer.resize.callCount, 1);
        assert.deepEqual(this.renderer.resize.firstCall.args, [250, 30], 'Pass canvas width and height to renderer');
    });

    QUnit.test('Create canvas when margin option is defined', function(assert) {
        this.createSparkline({
            dataSource: [1],
            size: {
                width: 250,
                height: 30
            },
            margin: {
                top: 1,
                bottom: 2,
                left: 3,
                right: 4
            }
        });
        canvas = this.getCanvas();
        var canvas = this.getCanvas();

        assert.deepEqual(canvas, { width: 250, height: 30, top: 1, bottom: 2, left: 3, right: 4 }, 'Canvas object is correct');
        assert.equal(this.renderer.resize.callCount, 1);
        assert.deepEqual(this.renderer.resize.firstCall.args, [250, 30], 'Pass canvas width and height to renderer');
    });

    QUnit.test('Create canvas when container size is defined', function(assert) {
        this.createSparkline({
            dataSource: [1]
        });
        canvas = this.getCanvas();
        var canvas = this.getCanvas();

        assert.deepEqual(canvas, { width: 250, height: 30, top: 3, bottom: 3, left: 5, right: 5 }, 'Canvas object is correct');
        assert.equal(this.renderer.resize.callCount, 1);
        assert.deepEqual(this.renderer.resize.firstCall.args, [250, 30], 'Pass canvas width and height to renderer');
    });

    //T124801
    QUnit.test('Create canvas when container size is not defined', function(assert) {
        var container = $('<div style="width: 100px">').appendTo(this.$container);

        this.createSparkline({ dataSource: [1] }, container);

        var canvas = this.getCanvas();

        assert.deepEqual(canvas, { width: 100, height: 30, top: 3, bottom: 3, left: 5, right: 5 }, 'Canvas object is correct');
        assert.equal(this.renderer.resize.callCount, 1);
        assert.deepEqual(this.renderer.resize.firstCall.args, [100, 30], 'Pass canvas width and height to renderer');
    });

    QUnit.module('Range', environment);

    QUnit.test('Create range when datasource has one point. Line', function(assert) {
        this.createSparkline({ dataSource: ["1"] }, null, { arg: {}, val: { min: 4, max: 4 } });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 1, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, 4, 'MinY is correct');
        assert.equal(ranges.val.max, 4, 'MaxY is correct');
    });

    QUnit.test('Create range when datasource has one point. Area/bar', function(assert) {
        this.createSparkline({ type: "area", dataSource: ["1"] }, null, { arg: { }, val: { min: 0, max: 4 } });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 1, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, 0, 'MinY is correct');
        assert.equal(ranges.val.max, 4.6, 'MaxY is correct');
    });

    QUnit.test('Create range when datasource has one point. Winloss', function(assert) {
        this.createSparkline({ type: 'winloss', dataSource: ["1"] }, null, { arg: {}, val: { min: 0, max: 1 } });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 1, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, 0, 'MinY is correct');
        assert.equal(ranges.val.max, 1.15, 'MaxY is correct');
    });

    QUnit.test('Create range when all points are positive. Line', function(assert) {
        this.createSparkline({ dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23"] }, null, {
            arg: {},
            val: {
                min: 1,
                max: 9
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 23, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min.toPrecision(2), -0.20, 'MinY is correct');
        assert.equal(ranges.val.max, 10.2, 'MaxY is correct');
    });

    QUnit.test('Create range when all points are positive. Bar/area', function(assert) {
        this.createSparkline({ type: 'bar', dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23"] }, null, {
            arg: {},
            val: {
                min: 0,
                max: 9
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 23, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, 0, 'MinY is correct');
        assert.equal(ranges.val.max, 10.35, 'MaxY is correct');
    });

    QUnit.test('Create range when all points are positive. Winloss', function(assert) {
        this.createSparkline({ type: 'winloss', dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23"] }, null, {
            arg: {},
            val: {
                min: 0,
                max: 1
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 23, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, 0, 'MinY is correct');
        assert.equal(ranges.val.max, 1.15, 'MaxY is correct');
    });

    QUnit.test('Create range when all points are negative. Line', function(assert) {
        this.createSparkline({ dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", ] }, null, {
            arg: {},
            val: {
                min: -9,
                max: -2
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 18, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, -10.05, 'MinY is correct');
        assert.equal(ranges.val.max, -0.95, 'MaxY is correct');
    });

    QUnit.test('Create range when all points are negative. Bar/area', function(assert) {
        this.createSparkline({ type: 'bar', dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18"] }, null, {
            arg: {},
            val: {
                min: -9,
                max: 0
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 18, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, -10.35, 'MinY is correct');
        assert.equal(ranges.val.max, 0, 'MaxY is correct');
    });

    QUnit.test('Create range when all points are negative. Winloss', function(assert) {
        this.createSparkline({ type: 'winloss', dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18"] }, null, {
            arg: {},
            val: {
                min: -1,
                max: 0
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 18, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, -1.15, 'MinY is correct');
        assert.equal(ranges.val.max, 0, 'MaxY is correct');
    });

    QUnit.test('Create range when datasource is continuous. Bar', function(assert) {
        this.createSparkline({ type: 'bar', dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"] }, null, {
            arg: {
                categories: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
            },
            val: {
                min: -4,
                max: 18
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 13, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, -7.3, 'MinY is correct');
        assert.equal(ranges.val.max, 21.3, 'MaxY is correct');
    });

    QUnit.test('Create range when datasource is continuous. Winloss', function(assert) {
        this.createSparkline({ type: 'winloss', dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"] }, null, {
            arg: {},
            val: {
                min: -1,
                max: 1
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 13, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, -1.3, 'MinY is correct');
        assert.equal(ranges.val.max, 1.3, 'MaxY is correct');
    });

    QUnit.test('Create range when there are minY and maxY options. part 1', function(assert) {
        this.createSparkline({ minValue: -5, maxValue: 5, dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"] }, null, {
            arg: {},
            val: {
                min: -10,
                max: 10
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 13, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, -13, 'MinY is correct');
        assert.equal(ranges.val.max, 13, 'MaxY is correct');
        assert.equal(ranges.val.minVisible, -5, 'MinY is correct');
        assert.equal(ranges.val.maxVisible, 5, 'MaxY is correct');
    });

    QUnit.test('Create range when there are minY and maxY options. part 2', function(assert) {
        this.createSparkline({ minValue: -15, maxValue: 15, dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"] }, null, {
            arg: {},
            val: {
                min: -10,
                max: 10
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 13, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, -13, 'MinY is correct');
        assert.equal(ranges.val.max, 13, 'MaxY is correct');
        assert.equal(ranges.val.minVisible, -15, 'MinY is correct');
        assert.equal(ranges.val.maxVisible, 15, 'MaxY is correct');
    });

    QUnit.test('Create range when there are minY and maxY null options', function(assert) {
        this.createSparkline({ minValue: null, maxValue: null, dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"] }, null, {
            arg: {},
            val: {
                min: -10,
                max: 10
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 13, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, -13, 'MinY is correct');
        assert.equal(ranges.val.max, 13, 'MaxY is correct');
        assert.strictEqual(ranges.val.minVisible, undefined, 'MinY is correct');
        assert.strictEqual(ranges.val.maxVisible, undefined, 'MaxY is correct');
    });

    QUnit.test('Create range when there are minY and maxY incorrect options. part 1', function(assert) {
        this.createSparkline({ minValue: "a", maxValue: "b", dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"] }, null, {
            arg: {},
            val: {
                min: -10,
                max: 10
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 13, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, -13, 'MinY is correct');
        assert.equal(ranges.val.max, 13, 'MaxY is correct');
        assert.strictEqual(ranges.val.minVisible, undefined, 'MinY is correct');
        assert.strictEqual(ranges.val.maxVisible, undefined, 'MaxY is correct');
    });

    QUnit.test('Create range when there are minY and maxY incorrect options. part 2', function(assert) {
        this.createSparkline({ minValue: 5, maxValue: "b", dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"] }, null, {
            arg: {},
            val: {
                min: -10,
                max: 10
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 13, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, -13, 'MinY is correct');
        assert.equal(ranges.val.max, 13, 'MaxY is correct');
        assert.equal(ranges.val.minVisible, 5, 'MinY is correct');
        assert.strictEqual(ranges.val.maxVisible, undefined, 'MaxY is correct');
    });

    QUnit.test('Create range when there are minY and maxY. min > max', function(assert) {
        this.createSparkline({ minValue: 2, maxValue: -1, dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"] }, null, {
            arg: {},
            val: {
                min: -10,
                max: 10
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 13, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, -13, 'MinY is correct');
        assert.equal(ranges.val.max, 13, 'MaxY is correct');
        assert.equal(ranges.val.minVisible, -1, 'MinY is correct');
        assert.equal(ranges.val.maxVisible, 2, 'MaxY is correct');
    });

    QUnit.test('Create range when there are minY and maxY. min = max', function(assert) {
        this.createSparkline({ minValue: 5, maxValue: 5, dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"] }, null, {
            arg: {},
            val: {
                min: -10,
                max: 10
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 13, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, -13, 'MinY is correct');
        assert.equal(ranges.val.max, 13, 'MaxY is correct');
        assert.equal(ranges.val.minVisible, 5, 'MinY is correct');
        assert.equal(ranges.val.maxVisible, 5, 'MaxY is correct');
    });

    QUnit.test('Create range when there are minY and maxY options for winloss. part 1', function(assert) {
        this.createSparkline({ type: "winloss", minValue: -0.6, maxValue: 0.2, dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"] }, null, {
            arg: {},
            val: {
                min: -1,
                max: 1
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 13, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, -1.3, 'MinY is correct');
        assert.equal(ranges.val.max, 1.3, 'MaxY is correct');
        assert.equal(ranges.val.minVisible, -0.6, 'MinY is correct');
        assert.equal(ranges.val.maxVisible, 0.2, 'MaxY is correct');
    });

    QUnit.test('Create range when there are minY and maxY options for winloss. part 2', function(assert) {
        this.createSparkline({ minValue: -5, maxValue: 20, type: "winloss", dataSource: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"] }, null, {
            arg: {},
            val: {
                min: -1,
                max: 1
            }
        });

        var ranges = this.getRanges();

        assert.ok(ranges.arg, 'Arg range was created');
        assert.ok(ranges.val, 'Val range was created');

        assert.equal(ranges.arg.categories.length, 13, 'Range categoriesX length is correct');
        assert.equal(ranges.val.min, -1.3, 'MinY is correct');
        assert.equal(ranges.val.max, 1.3, 'MaxY is correct');
        assert.equal(ranges.val.minVisible, -1, 'MinY is correct');
        assert.equal(ranges.val.maxVisible, 1, 'MaxY is correct');
    });

    QUnit.module('Prepare series options', $.extend({}, environment, {
        getExpectedTheme: function(widget, options) {
            var themeManager = new baseThemeManagerModule.BaseThemeManager();
            themeManager.setCallback(noop);
            themeManager._themeSection = "sparkline";
            themeManager._fontFields = ["tooltip.font"];
            themeManager.setTheme(options ? options.theme : null);
            var expected = $.extend(true, {}, themeManager.theme(), options);
            $.each(["defaultOptionsRules", "onIncidentOccurred", "onInitialized", "onDisposing", "onOptionChanged", "rtlEnabled", "disabled", "elementAttr", "integrationOptions"], function(_, name) {
                expected[name] = widget._allOptions[name];
            });
            delete expected.size;
            return expected;
        },
        beforeEach: function() {
            environment.beforeEach.apply(this, arguments);
        },
        afterEach: function() {
            environment.afterEach.apply(this, arguments);
        }
    }));

    QUnit.test('Prepare all options when all options are defined', function(assert) {
        var options = {
                dataSource: [1],
                type: 'line',
                lineColor: 'deepskyblue',
                lineWidth: 2,
                areaOpacity: 0.2,
                size: {
                    width: 250,
                    height: 30
                },
                margin: {
                    top: 1,
                    bottom: 2,
                    left: 3,
                    right: 4
                },
                argumentField: 'arg',
                valueField: 'val',
                showFirstLast: true,
                showMinMax: true,
                minColor: 'orangered',
                maxColor: 'black',
                firstLastColor: 'gold',
                pointSize: 4,
                pointSymbol: 'cross',
                pointColor: 'pink',
                winlossThreshold: 5,
                barPositiveColor: 'blue',
                barNegativeColor: 'yellow',
                winColor: 'pink',
                lossColor: 'green',
                tooltip: {
                    paddingLeftRight: 14,
                    paddingTopBottom: 10,
                    arrowLength: 10,
                    enabled: false,
                    verticalAlignment: 'top',
                    horizontalAlignment: 'center',
                    format: 'fixedPoint',
                    precision: 2,
                    color: 'gold',
                    opacity: 0.9,
                    border: {
                        color: "#aaaaaa",
                        opacity: 0.3,
                        width: 2,
                        dashStyle: 'dash',
                        visible: true
                    },
                    font: {
                        color: 'blue',
                        family: 'Segoe UI',
                        opacity: 0.5,
                        size: 14,
                        weight: 400
                    },
                    shadow: {
                        blur: 2,
                        color: "#000000",
                        offsetX: 0,
                        offsetY: 4,
                        opacity: 0.4
                    }
                }
            },
            sparkline = this.createSparkline(options);

        delete sparkline._allOptions.size;
        assert.deepEqual(sparkline._allOptions, this.getExpectedTheme(sparkline, options), 'All sparkline options should be correct');
        assert.equal(seriesModule.Series.lastCall.args[1].widgetType, "chart");
    });

    QUnit.test('Prepare all options when all options are not defined', function(assert) {
        var sparkline = this.createSparkline({});

        delete sparkline._allOptions.size;
        assert.deepEqual(sparkline._allOptions, this.getExpectedTheme(sparkline, {}), 'All sparkline options should be correct');
    });

    QUnit.test('Prepare options when theme is object', function(assert) {
        var sparkline = this.createSparkline({
            dataSource: [9],
            theme: {
                minColor: 'orange'
            },
            maxColor: 'blue'
        });

        delete sparkline._allOptions.size;
        assert.deepEqual(sparkline._allOptions, this.getExpectedTheme(sparkline, {
            dataSource: [9],
            theme: {
                minColor: 'orange'
            },
            maxColor: 'blue'
        }), 'All sparkline options should be correct');
    });

    QUnit.test('Customize default theme', function(assert) {
        var myTheme = {
            name: 'myTheme',
            sparkline: {
                maxColor: 'yellow'
            }
        };
        themeModule.registerTheme(myTheme, 'default');

        var sparkline = this.createSparkline({
            theme: 'myTheme'
        });

        delete sparkline._allOptions.size;
        assert.deepEqual(sparkline._allOptions, this.getExpectedTheme(sparkline, {
            theme: 'myTheme'
        }), 'All options should be correct');
    });

    QUnit.test('Implement custom theme', function(assert) {
        var myTheme = {
            name: 'myTheme',
            sparkline: {
                maxColor: 'yellow'
            }
        };

        themeModule.registerTheme(myTheme);

        var sparkline = this.createSparkline({
            theme: 'myTheme'
        });

        delete sparkline._allOptions.size;
        assert.deepEqual(sparkline._allOptions, this.getExpectedTheme(sparkline, { theme: 'myTheme' }), 'All options should be correct');
    });

    QUnit.test('Dark theme', function(assert) {
        var sparkline = this.createSparkline({
            theme: 'desktop.dark'
        });

        delete sparkline._allOptions.size;
        assert.deepEqual(sparkline._allOptions, this.getExpectedTheme(sparkline, { theme: 'desktop.dark' }), 'All options should be correct');
    });

    QUnit.test('Prepare series options when type is incorrect', function(assert) {
        this.createSparkline({ type: 'abc' });

        var options = this.getSeriesOptions();
        assert.equal(options.type, 'line', 'Series type should be correct');
    });

    QUnit.test('Prepare series options when type is incorrect', function(assert) {
        this.createSparkline({ dataSource: [3], type: 'pie' });

        var options = this.getSeriesOptions();
        assert.equal(options.type, 'line', 'Series type should be correct');
    });

    QUnit.test('Prepare series options when type is incorrect', function(assert) {
        this.createSparkline({ dataSource: [3], type: 'stepLine' });

        var options = this.getSeriesOptions();
        assert.equal(options.type, 'stepline', 'Series type should be correct');
    });

    QUnit.test('Prepare series options when type is incorrect', function(assert) {
        this.createSparkline({ dataSource: [3], type: 111 });

        var options = this.getSeriesOptions();
        assert.equal(options.type, 'line', 'Series type should be correct');
    });

    QUnit.test('Prepare series options when type is incorrect', function(assert) {
        this.createSparkline({ dataSource: [3], type: null });

        var options = this.getSeriesOptions();
        assert.equal(options.type, 'line', 'Series type should be correct');
    });

    QUnit.test('Prepare series options when type is incorrect', function(assert) {
        this.createSparkline({ dataSource: [3], type: NaN });

        var options = this.getSeriesOptions();
        assert.equal(options.type, 'line', 'Series type should be correct');
    });

    QUnit.test('Prepare series options. Creation', function(assert) {
        this.createSparkline({
            dataSource: [1]
        });

        var options = this.getSeriesOptions();
        assert.ok(options, 'Series options should be created');

        assert.ok(!options.extremumPoints, 'Extremum points options should be deleted from series options');
        assert.ok(!options.size, 'Size options should be deleted from series options');
        assert.ok(!options.dataSource, 'Datasource option should be deleted from series options');
        assert.ok(!options.winloss, 'Winloss options should be deleted from series options');

        assert.ok(options.point, 'Point options should be in series options');
        assert.ok(options.border, 'Border options should be in series options');
    });

    QUnit.test('Prepare series options. Winloss', function(assert) {
        this.createSparkline({ type: 'winloss' });

        var options = this.getSeriesOptions();

        assert.ok(options, 'Series options should be created');
        assert.equal(options.type, 'bar', 'Series type should be bar');
        assert.equal(options.border.visible, false, 'Series border should not be visible');
    });

    QUnit.test('Prepare series options. Bar', function(assert) {
        this.createSparkline({ type: 'bar' });

        var options = this.getSeriesOptions();

        assert.ok(options, 'Series options should be created');
        assert.equal(options.type, 'bar', 'Series type should be bar');
        assert.equal(options.border.visible, false, 'Series border should not be visible');
    });

    QUnit.test('Prepare series options. Not winloss', function(assert) {
        this.createSparkline({ type: 'area' });

        var options = this.getSeriesOptions();
        assert.ok(options, 'Series options should be created');
        assert.equal(options.type, 'area', 'Series type should be line');
    });

    QUnit.test('Prepare series options. Check options', function(assert) {
        this.createSparkline({});

        var options = this.getSeriesOptions();

        assert.ok(options, 'Series options should be created');

        assert.equal(options.color, '#666666', 'Series color should be correct');
        assert.equal(options.width, 2, 'Series width should be correct');
        assert.equal(options.argumentField, 'arg', 'Series argument field should be correct');
        assert.equal(options.valueField, 'val', 'Series value field should be correct');
        assert.equal(options.type, 'line', 'Series type should be correct');

        assert.equal(options.point.visible, false, 'Series points should not be correct');
        assert.equal(options.point.symbol, 'circle', 'Series point symbol should be correct');
        assert.equal(options.point.size, 4, 'Series point size should be correct');

        assert.equal(options.border.color, '#666666', 'Series border color should be like series color');
        assert.equal(options.border.width, 2, 'Series border width should be like series width');
        assert.equal(options.border.visible, true, 'Series border should be visible');
    });

    QUnit.test('Get bar width when there are two points', function(assert) {
        this.series.getPoints.returns([
            { argument: 1, value: 2, correctCoordinates: sinon.spy() },
            { argument: 2, value: 3, correctCoordinates: sinon.spy() }
        ]);

        this.createSparkline({
            dataSource: [{ arg: 1, val: 1 }],
            type: "bar"
        });

        var point = this.series.getPoints()[0];

        assert.equal(point.correctCoordinates.firstCall.args[0].width, 50, "Bar width should not be more than 50");
    });

    QUnit.test('Get bar width when there are ten points', function(assert) {
        var points = [];
        for(var i = 0; i < 10; i++) {
            points.push({ correctCoordinates: sinon.spy() });
        }
        this.series.getPoints.returns(points);
        this.createSparkline({
            dataSource: [{ arg: 1, val: 1 }],
            type: "bar",
            size: {
                width: 200
            },
            margin: {
                left: 20,
                right: 30
            }
        });

        var point = this.series.getPoints()[0];
        assert.equal(point.correctCoordinates.firstCall.args[0].width, 11, "Bar width should be correct");
    });

    QUnit.test('Get bar width when there are 150 points', function(assert) {
        var points = [];
        for(var i = 0; i < 150; i++) {
            points.push({ correctCoordinates: sinon.spy() });
        }
        this.series.getPoints.returns(points);
        this.createSparkline({
            dataSource: [{ arg: 1, val: 1 }],
            type: "bar",
            size: {
                width: 200
            },
            margin: {
                left: 20,
                right: 30
            }
        });

        var point = this.series.getPoints()[0];
        assert.equal(point.correctCoordinates.firstCall.args[0].width, 1, "Bar width should not be less than 1");
    });

    QUnit.module('Prepare datasource', getEnvironmentWithStubValidateData());

    QUnit.test('Prepare datasource when it is array of object with continuous arguments', function(assert) {
        this.createSparkline({
            dataSource: [{ arg: 1, val: 1 }, { arg: 2, val: 2 }]
        });

        var data = this.getData();

        assert.equal(data.length, 2, 'Data source should have two items');
        assert.equal(data[0].arg, 1, 'First data source item should be correct');
        assert.equal(data[0].val, 1, 'First data source item should be correct');
        assert.equal(data[1].arg, 2, 'Second data source item should be correct');
        assert.equal(data[1].val, 2, 'Second data source item should be correct');
    });

    QUnit.test('Prepare datasource when one data is undefined. Argument', function(assert) {
        this.createSparkline({
            valueField: 'count',
            dataSource: [{ arg: 1, count: 10 }, { arg: undefined, count: 3 }]
        });

        var data = this.getData();

        assert.equal(data.length, 1, 'Data source should have one item');
        assert.equal(data[0].arg, 1, 'First data source item should be correct');
        assert.equal(data[0].count, 10, 'First data source item should be correct');
    });

    QUnit.test('Prepare datasource when one data is undefined. Value', function(assert) {
        this.createSparkline({
            valueField: 'count',
            dataSource: [{ arg: 1, count: 10 }, { arg: undefined, count: undefined }]
        });

        var data = this.getData();
        assert.equal(data.length, 1, 'Data source should have one item');
        assert.equal(data[0].arg, 1, 'First data source item should be correct');
        assert.equal(data[0].count, 10, 'First data source item should be correct');
    });

    QUnit.test('Prepare datasource when one data is undefined. Both', function(assert) {
        this.createSparkline({
            valueField: 'count',
            dataSource: [{ arg: 1, count: 10 }, { arg: undefined, count: undefined }]
        });

        var data = this.getData();
        assert.equal(data.length, 1, 'Data source should have one item');
        assert.equal(data[0].arg, 1, 'First data source item should be correct');
        assert.equal(data[0].count, 10, 'First data source item should be correct');
    });

    QUnit.test('Prepare datasource when one data is undefined. Array of numbers', function(assert) {
        this.createSparkline({
            dataSource: [5, 4, undefined, 6]
        });

        var data = this.getData();
        assert.equal(data.length, 3, 'Data source should have one item');
        assert.equal(data[0].arg, '0', 'First data source item should be correct');
        assert.equal(data[0].val, 5, 'First data source item should be correct');
        assert.equal(data[1].arg, '1', 'Second data source item should be correct');
        assert.equal(data[1].val, 4, 'Second data source item should be correct');
        assert.equal(data[2].arg, '3', 'Third data source item should be correct');
        assert.equal(data[2].val, 6, 'Third data source item should be correct');
    });

    QUnit.test('Prepare datasource - B251275', function(assert) {
        this.createSparkline({
            valueField: 'count',
            dataSource: [{ arg: 1, count: 10 }, { arg: 2, count: 5 }, { arg1: 3, val: 4 }]
        });

        var data = this.getData();
        assert.equal(data.length, 2, 'Data source should have two items');
        assert.equal(data[0].arg, 1, 'First data source item should be correct');
        assert.equal(data[0].count, 10, 'First data source item should be correct');
        assert.equal(data[1].arg, 2, 'Second data source item should be correct');
        assert.equal(data[1].count, 5, 'Second data source item should be correct');
    });

    QUnit.test('Prepare datasource when it is array of object with discrete arguments', function(assert) {
        this.createSparkline({
            dataSource: [{ arg: '1', val: 1 }, { arg: '2', val: 2 }]
        });

        var data = this.getData();
        assert.equal(data.length, 2, 'Data source should have two items');
        assert.equal(data[0].arg, '1', 'First data source item should be correct');
        assert.equal(data[0].val, 1, 'First data source item should be correct');
        assert.equal(data[1].arg, '2', 'Second data source item should be correct');
        assert.equal(data[1].val, 2, 'Second data source item should be correct');
    });

    QUnit.test('Prepare datasource when it is array of numbers and argument and value field are not defined', function(assert) {
        this.createSparkline({
            dataSource: [1, 2]
        });

        var data = this.getData();

        assert.equal(data.length, 2, 'Data source should have two items');
        assert.equal(data[0].arg, '0', 'First data source item should be correct');
        assert.equal(data[0].val, 1, 'First data source item should be correct');
        assert.equal(data[1].arg, '1', 'Second data source item should be correct');
        assert.equal(data[1].val, 2, 'Second data source item should be correct');
    });

    QUnit.test('Prepare datasource when it is array of numbers and argument and value field are defined', function(assert) {
        this.createSparkline({
            argumentField: 'arg',
            valueField: 'count',
            dataSource: [1, 2]
        });

        var data = this.getData();

        assert.equal(data.length, 2, 'Data source should have two items');
        assert.equal(data[0].arg, '0', 'First data source item should be correct');
        assert.equal(data[0].count, 1, 'First data source item should be correct');
        assert.equal(data[1].arg, '1', 'Second data source item should be correct');
        assert.equal(data[1].count, 2, 'Second data source item should be correct');
    });

    QUnit.test('Prepare winloss datasource', function(assert) {
        this.createSparkline({
            dataSource: [10, 2, 0, -1],
            type: 'winloss'
        });

        var data = this.getData();
        assert.equal(data.length, 4, 'Data source should have two items');
        assert.equal(data[0].arg, '0', 'First data source item should be correct');
        assert.equal(data[0].val, 1, 'First data source item should be correct');
        assert.equal(data[1].arg, '1', 'Second data source item should be correct');
        assert.equal(data[1].val, 1, 'Second data source item should be correct');
        assert.equal(data[2].arg, '2', 'Third data source item should be correct');
        assert.equal(data[2].val, 0, 'Third data source item should be correct');
        assert.equal(data[3].arg, '3', 'Fourth data source item should be correct');
        assert.equal(data[3].val, -1, 'Fourth data source item should be correct');
    });

    QUnit.test('B239983. Datasource is array with string', function(assert) {
        var sparkline = this.createSparkline({
                dataSource: ['10', '3', '7']
            }),
            data = this.getData();

        assert.equal(data.length, 3, 'Data source should have three items');
        assert.equal(data[0].arg, '0', 'First data source item should be correct');
        assert.equal(data[0].val, 10, 'First data source item should be correct');
        assert.equal(data[1].arg, '1', 'Second data source item should be correct');
        assert.equal(data[1].val, 3, 'Second data source item should be correct');
        assert.equal(data[2].arg, '2', 'Third data source item should be correct');
        assert.equal(data[2].val, 7, 'Third data source item should be correct');

        assert.equal(sparkline._minMaxIndexes.minIndex, 1, 'Min index should be 1');
        assert.equal(sparkline._minMaxIndexes.maxIndex, 0, 'Max index should be 0');
    });

    QUnit.test('B239983. Datasource is array with object and string', function(assert) {
        var sparkline = this.createSparkline({
                dataSource: [{ arg: '0', val: '10' }, { arg: '1', val: '3' }, { arg: '2', val: '13' }]
            }),
            data = this.getData();

        assert.equal(data.length, 3, 'Data source should have three items');
        assert.equal(data[0].arg, '0', 'First data source item should be correct');
        assert.equal(data[0].val, 10, 'First data source item should be correct');
        assert.equal(data[1].arg, '1', 'Second data source item should be correct');
        assert.equal(data[1].val, 3, 'Second data source item should be correct');
        assert.equal(data[2].arg, '2', 'Third data source item should be correct');
        assert.equal(data[2].val, 13, 'Third data source item should be correct');

        assert.equal(sparkline._minMaxIndexes.minIndex, 1, 'Min index should be 1');
        assert.equal(sparkline._minMaxIndexes.maxIndex, 2, 'Max index should be 2');
    });

    QUnit.test('null value in dataSource', function(assert) {
        this.createSparkline({
            dataSource: [1, 2, null, 4]
        });

        var data = this.getData();
        assert.strictEqual(data.length, 4, 'size simpleDataSource');
        assert.strictEqual(data[0].val, 1);
        assert.strictEqual(data[1].val, 2);
        assert.strictEqual(data[2].val, null);
        assert.strictEqual(data[3].val, 4);
    });

    QUnit.test('null value in dataSource with ignoreEmptyPoints', function(assert) {
        this.createSparkline({
            ignoreEmptyPoints: true,
            dataSource: [1, 2, null, 4]
        });

        var data = this.getData();
        assert.strictEqual(data.length, 3, 'size simpleDataSource');
        assert.strictEqual(data[0].val, 1);
        assert.strictEqual(data[1].val, 2);
        assert.strictEqual(data[2].val, 4);
    });

    QUnit.test("pass validateData correct argumentAxisType, winloss", function(assert) {
        this.createSparkline({
            dataSource: [1],
            type: 'winloss'
        });

        assert.equal(dataValidatorModule.validateData.firstCall.args[1].argumentOptions.type, "discrete");
    });

    QUnit.test("pass validateData correct argumentAxisType, bar", function(assert) {
        this.createSparkline({
            dataSource: [1],
            type: 'bar'
        });

        assert.equal(dataValidatorModule.validateData.firstCall.args[1].argumentOptions.type, "discrete");
    });

    QUnit.test("pass validateData correct argumentAxisType, area", function(assert) {
        this.createSparkline({
            dataSource: [1],
            type: 'area'
        });
        assert.equal(dataValidatorModule.validateData.firstCall.args[1].argumentOptions.type, undefined);
    });

    QUnit.module('Customize points', environment);

    QUnit.test('Get extremum points indexes when datasource is not ordered - B239987', function(assert) {
        this.createSparkline({
            dataSource: [{ arg: 9, val: 10 }, { arg: 5, val: 1 }, { arg: 4, val: 1 }],
            showMinMax: true
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;

        assert.deepEqual(customizeFunction.call({ index: 0, value: 10 }), { border: { color: "#e55253" }, visible: true });
        assert.deepEqual(customizeFunction.call({ index: 1, value: 1 }), { border: { color: "#e8c267" }, visible: true });
        assert.deepEqual(customizeFunction.call({ index: 2, value: 1 }), { border: { color: "#666666" }, visible: true });
    });

    QUnit.test('Get extremum points indexes when mode is first last', function(assert) {
        this.createSparkline({
            dataSource: [1, 8, 6, 9, 5]
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 1 }), { border: { color: "#666666" }, visible: true }, "first point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 9 }), {});
        assert.deepEqual(customizeFunction.call({ index: 2, value: 6 }), {});
        assert.deepEqual(customizeFunction.call({ index: 3, value: 9 }), {});
        assert.deepEqual(customizeFunction.call({ index: 4, value: 5 }), { border: { color: "#666666" }, visible: true }, "last point");
    });

    QUnit.test('Get extremum points indexes when mode is min max', function(assert) {
        this.createSparkline({
            dataSource: [1, 8, 6, 9, 5],
            showFirstLast: false,
            showMinMax: true
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 1 }), { border: { color: "#e8c267" }, visible: true }, "min point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 8 }), {});
        assert.deepEqual(customizeFunction.call({ index: 2, value: 6 }), {});
        assert.deepEqual(customizeFunction.call({ index: 3, value: 9 }), { border: { color: "#e55253" }, visible: true }, "max point");
        assert.deepEqual(customizeFunction.call({ index: 4, value: 5 }), {});
    });

    QUnit.test('Get extremum points indexes when mode is extremum', function(assert) {
        this.createSparkline({
            dataSource: [1, 8, 6, 9, 5],
            showFirstLast: true,
            showMinMax: true
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 1 }), { border: { color: "#e8c267" }, visible: true }, "min point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 8 }), {});
        assert.deepEqual(customizeFunction.call({ index: 2, value: 6 }), {});
        assert.deepEqual(customizeFunction.call({ index: 3, value: 9 }), { border: { color: "#e55253" }, visible: true }, "max point");
        assert.deepEqual(customizeFunction.call({ index: 4, value: 5 }), { border: { color: "#666666" }, visible: true }, "last point");
    });

    QUnit.test('Get extremum points indexes when mode is none', function(assert) {
        this.createSparkline({
            dataSource: [1, 8, 6, 9, 5],
            showFirstLast: false,
            showMinMax: false
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 1 }), {});
        assert.deepEqual(customizeFunction.call({ index: 1, value: 8 }), {});
        assert.deepEqual(customizeFunction.call({ index: 2, value: 6 }), {});
        assert.deepEqual(customizeFunction.call({ index: 3, value: 9 }), {});
        assert.deepEqual(customizeFunction.call({ index: 4, value: 5 }), {});
    });

    QUnit.test('Extremum points when mode is firstLast. Default options. Line, spline, stepline, area, splinearea, steparea', function(assert) {
        this.createSparkline({
            dataSource: [4, 9, 8, 6]
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 4 }), { border: { color: "#666666" }, visible: true }, "first point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 9 }), {});
        assert.deepEqual(customizeFunction.call({ index: 2, value: 8 }), {});
        assert.deepEqual(customizeFunction.call({ index: 3, value: 6 }), { border: { color: "#666666" }, visible: true }, "last point");
    });

    QUnit.test('Extremum points when mode is firstLast. Custom options. Line, spline, stepline, area, splinearea, steparea', function(assert) {
        this.createSparkline({
            dataSource: [4, 9, 8, 6],
            firstLastColor: 'blue'
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 4 }), { border: { color: "blue" }, visible: true }, "first point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 9 }), {});
        assert.deepEqual(customizeFunction.call({ index: 2, value: 8 }), {});
        assert.deepEqual(customizeFunction.call({ index: 3, value: 6 }), { border: { color: "blue" }, visible: true }, "last point");
    });

    QUnit.test('Extremum points when mode is firstLast. Default options. Bar, winloss', function(assert) {
        this.createSparkline({
            dataSource: [4, 9, -8, 6],
            type: 'bar'
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 4 }), { color: "#666666" }, "first point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 9 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 2, value: -8 }), { color: "#d7d7d7" });
        assert.deepEqual(customizeFunction.call({ index: 3, value: 6 }), { color: "#666666" }, "last point");
    });

    QUnit.test('Extremum points when mode is firstLast. Custom options. Bar, winloss', function(assert) {
        this.createSparkline({
            dataSource: [4, 9, -8, 6],
            type: 'bar',
            firstLastColor: 'yellow'
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 4 }), { color: "yellow" }, "first point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 9 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 2, value: -8 }), { color: "#d7d7d7" });
        assert.deepEqual(customizeFunction.call({ index: 3, value: 6 }), { color: "yellow" }, "last point");
    });

    QUnit.test('Extremum points when mode is minMax. Line, spline, stepline, area, splinearea, steparea', function(assert) {
        this.createSparkline({
            dataSource: [4, 9, 8, 6],
            showFirstLast: false,
            showMinMax: true
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 4 }), { border: { color: "#e8c267" }, visible: true }, "min point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 9 }), { border: { color: "#e55253" }, visible: true }, "max point");
        assert.deepEqual(customizeFunction.call({ index: 2, value: 8 }), {});
        assert.deepEqual(customizeFunction.call({ index: 3, value: 6 }), {});
    });


    QUnit.test('Extremum points when mode is minMax. Bar, winloss', function(assert) {
        this.createSparkline({
            dataSource: [4, 9, 8, 6],
            type: 'bar',
            showFirstLast: false,
            showMinMax: true
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 4 }), { color: "#e8c267" }, "min point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 9 }), { color: "#e55253" }, "max point");
        assert.deepEqual(customizeFunction.call({ index: 2, value: 8 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 3, value: 6 }), { color: "#a9a9a9" });
    });

    QUnit.test('Extremum points when mode is extremum. Line, spline, stepline, area, splinearea, steparea. FirstLast and minMax points are different', function(assert) {
        this.createSparkline({
            dataSource: [1, 5, -8, 4, 8, 6],
            showFirstLast: true,
            showMinMax: true
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 1 }), { border: { color: "#666666" }, visible: true }, "first point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 5 }), {});
        assert.deepEqual(customizeFunction.call({ index: 2, value: -8 }), { border: { color: "#e8c267" }, visible: true }, "min point");
        assert.deepEqual(customizeFunction.call({ index: 3, value: 4 }), {});
        assert.deepEqual(customizeFunction.call({ index: 4, value: 8 }), { border: { color: "#e55253" }, visible: true }, "max point");
        assert.deepEqual(customizeFunction.call({ index: 5, value: 6 }), { border: { color: "#666666" }, visible: true }, "last point");
    });

    QUnit.test('Extremum points when mode is extremum. Line, spline, stepline, area, splinearea, steparea. Three points, min or max point is first or last', function(assert) {
        this.createSparkline({
            dataSource: [1, 5, -8, 4, 8, 16],
            showFirstLast: true,
            showMinMax: true
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 1 }), { border: { color: "#666666" }, visible: true }, "first point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 5 }), {});
        assert.deepEqual(customizeFunction.call({ index: 2, value: -8 }), { border: { color: "#e8c267" }, visible: true }, "min point");
        assert.deepEqual(customizeFunction.call({ index: 3, value: 4 }), {});
        assert.deepEqual(customizeFunction.call({ index: 4, value: 8 }), {});
        assert.deepEqual(customizeFunction.call({ index: 5, value: 16 }), { border: { color: "#e55253" }, visible: true }, "last and max point");
    });

    QUnit.test('Extremum points when mode is extremum. Line, spline, stepline, area, splinearea, steparea. Two points, minMax points are firstLast', function(assert) {
        this.createSparkline({
            dataSource: [1, 5, 8, 4, 8, 16],
            showFirstLast: true,
            showMinMax: true
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 1 }), { border: { color: "#e8c267" }, visible: true }, "first and min point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 5 }), {});
        assert.deepEqual(customizeFunction.call({ index: 2, value: 8 }), {});
        assert.deepEqual(customizeFunction.call({ index: 3, value: 4 }), {});
        assert.deepEqual(customizeFunction.call({ index: 4, value: 8 }), {});
        assert.deepEqual(customizeFunction.call({ index: 5, value: 16 }), { border: { color: "#e55253" }, visible: true }, "last and max point");
    });

    QUnit.test('Extremum points when mode is extremum. Line, spline, stepline, area, splinearea, steparea. Two min and max points', function(assert) {
        this.createSparkline({
            dataSource: [1, 5, -8, -8, 16, 16, 14],
            showFirstLast: true,
            showMinMax: true
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 1 }), { border: { color: "#666666" }, visible: true }, "first point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 5 }), {});
        assert.deepEqual(customizeFunction.call({ index: 2, value: -8 }), { border: { color: "#e8c267" }, visible: true }, "min point");
        assert.deepEqual(customizeFunction.call({ index: 3, value: -8 }), {});
        assert.deepEqual(customizeFunction.call({ index: 4, value: 16 }), { border: { color: "#e55253" }, visible: true }, "max point");
        assert.deepEqual(customizeFunction.call({ index: 5, value: 16 }), {});
        assert.deepEqual(customizeFunction.call({ index: 6, value: 14 }), { border: { color: "#666666" }, visible: true }, "last point");
    });

    QUnit.test('Extremum points when mode is extremum. Bar, winloss. FirstLast and minMax points are different', function(assert) {
        this.createSparkline({
            dataSource: [1, 5, -8, 4, 8, 6],
            type: 'bar',
            showFirstLast: true,
            showMinMax: true,
            firstLastColor: 'yellow'
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 1 }), { color: "yellow" }, "first point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 5 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 2, value: -8 }), { color: "#e8c267" }, "min point");
        assert.deepEqual(customizeFunction.call({ index: 3, value: 4 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 4, value: 8 }), { color: "#e55253" }, "max point");
        assert.deepEqual(customizeFunction.call({ index: 5, value: 6 }), { color: "yellow" }, "last point");
    });

    QUnit.test('Extremum points when mode is extremum. Bar, winloss. Three points, min or max point is first or last', function(assert) {
        this.createSparkline({
            dataSource: [1, 5, -8, 4, 8, 16],
            type: 'bar',
            showFirstLast: true,
            showMinMax: true,
            firstLastColor: 'yellow'
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 1 }), { color: "yellow" }, "first point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 5 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 2, value: -8 }), { color: "#e8c267" }, "min point");
        assert.deepEqual(customizeFunction.call({ index: 3, value: 4 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 4, value: 8 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 5, value: 16 }), { color: "#e55253" }, "last and max point");
    });

    QUnit.test('Extremum points when mode is extremum. Bar, winloss. Two points, minMax points are firstLast', function(assert) {
        this.createSparkline({
            dataSource: [1, 5, 8, 4, 8, 16],
            type: 'bar',
            showFirstLast: true,
            showMinMax: true,
            firstLastColor: 'yellow'
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;

        assert.deepEqual(customizeFunction.call({ index: 0, value: 1 }), { color: "#e8c267" }, "first and min point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 5 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 2, value: 8 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 3, value: 4 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 4, value: 8 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 5, value: 16 }), { color: "#e55253" }, "last and max point");
    });

    QUnit.test('Extremum points when mode is extremum. Bar. Two min and max points', function(assert) {
        this.createSparkline({
            dataSource: [1, 5, -8, -8, 16, 16, 14],
            type: 'bar',
            showFirstLast: true,
            showMinMax: true,
            firstLastColor: 'yellow'
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;

        assert.deepEqual(customizeFunction.call({ index: 0, value: 1 }), { color: "yellow" }, "first point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 5 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 2, value: -8 }), { color: "#e8c267" }, "min point");
        assert.deepEqual(customizeFunction.call({ index: 3, value: -8 }), { color: "#d7d7d7" });
        assert.deepEqual(customizeFunction.call({ index: 4, value: 16 }), { color: "#e55253" }, "max point");
        assert.deepEqual(customizeFunction.call({ index: 5, value: 16 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 6, value: 14 }), { color: "yellow" }, "last point");
    });

    QUnit.test('Extremum points when mode is none. Line, spline, stepline, area, splinearea, steparea', function(assert) {
        this.createSparkline({
            dataSource: [1, 5, -8, -8, 16, 16, 14],
            showFirstLast: false,
            showMinMax: false
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 1 }), {});
        assert.deepEqual(customizeFunction.call({ index: 1, value: 5 }), {});
        assert.deepEqual(customizeFunction.call({ index: 2, value: -8 }), {});
        assert.deepEqual(customizeFunction.call({ index: 3, value: -8 }), {});
        assert.deepEqual(customizeFunction.call({ index: 4, value: 16 }), {});
        assert.deepEqual(customizeFunction.call({ index: 5, value: 16 }), {});
        assert.deepEqual(customizeFunction.call({ index: 6, value: 14 }), {});
    });

    QUnit.test('Extremum points when mode is none. Bar, winloss', function(assert) {
        this.createSparkline({
            dataSource: [1, 5, -8, 14],
            type: 'bar',
            showFirstLast: false,
            showMinMax: false
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;

        assert.deepEqual(customizeFunction.call({ index: 0, value: 1 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 1, value: 5 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 2, value: -8 }), { color: "#d7d7d7" });
        assert.deepEqual(customizeFunction.call({ index: 3, value: 14 }), { color: "#a9a9a9" });
    });

    QUnit.test('Bar points. Default', function(assert) {
        this.createSparkline({
            type: 'bar',
            dataSource: [0, 3, 6, -8]
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 0 }), { color: "#666666" }, "first point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 3 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 2, value: 6 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 3, value: -8 }), { color: "#666666" }, "last point");
    });

    QUnit.test('Bar points. Custom', function(assert) {
        this.createSparkline({
            type: 'bar',
            barPositiveColor: 'yellow',
            barNegativeColor: 'blue',
            firstLastColor: 'pink',
            dataSource: [0, 3, 6, -8]
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 0 }), { color: "pink" }, "first point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 3 }), { color: "yellow" });
        assert.deepEqual(customizeFunction.call({ index: 2, value: 6 }), { color: "yellow" });
        assert.deepEqual(customizeFunction.call({ index: 3, value: -8 }), { color: "pink" }, "last point");
    });

    QUnit.test('Winloss points. Default', function(assert) {
        this.createSparkline({
            type: 'winloss',
            dataSource: [0, 3, 6, -8]
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 0 }), { color: "#666666" }, "first point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 3 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 2, value: 6 }), { color: "#a9a9a9" });
        assert.deepEqual(customizeFunction.call({ index: 3, value: -8 }), { color: "#666666" }, "last point");
    });

    QUnit.test('Winloss points. Custom', function(assert) {
        this.createSparkline({
            type: 'winloss',
            winColor: 'yellow',
            lossColor: 'blue',
            firstLastColor: 'pink',
            winlossThreshold: 4,
            dataSource: [0, 3, 6, -8]
        });

        var customizeFunction = this.getSeriesOptions().customizePoint;
        assert.deepEqual(customizeFunction.call({ index: 0, value: 0 }), { color: "pink" }, "first point");
        assert.deepEqual(customizeFunction.call({ index: 1, value: 3 }), { color: "blue" });
        assert.deepEqual(customizeFunction.call({ index: 2, value: 6 }), { color: "yellow" });
        assert.deepEqual(customizeFunction.call({ index: 3, value: -8 }), { color: "pink" }, "last point");
    });

    QUnit.module('Creating', environment);

    QUnit.test('Tooltip is not created on widget creation', function(assert) {
        var sparkline = this.createSparkline({});

        assert.equal(tooltipModule.Tooltip.callCount, 0);
        assert.ok(!("_tooltip" in sparkline));
        assert.deepEqual(this.renderer.root.attr.lastCall.args, [{ "pointer-events": "visible" }]);
    });

    QUnit.test('Create html groups', function(assert) {
        this.createSparkline({
            dataSource: [{ arg: 1, val: 1 }]
        });

        assert.deepEqual(this.renderer.g.firstCall.returnValue.attr.firstCall.args[0], { "class": "dxsl-series" }, 'Series group should be created');
        assert.ok(this.renderer.g.firstCall.returnValue.append.called, 'Series group should be appended');

        assert.deepEqual(this.renderer.g.secondCall.returnValue.attr.firstCall.args[0], { "class": "dxsl-series-labels" }, 'Series labels group should be created');
        assert.ok(!this.renderer.g.secondCall.returnValue.append.called, 'Series labels group should not be appended');
    });

    QUnit.test('Creating helpers', function(assert) {
        this.createSparkline({ dataSource: [1] });

        assert.equal(rendererModule.Renderer.firstCall.args[0].cssClass, "dxsl dxsl-sparkline");

        assert.equal(translator2DModule.Translator2D.callCount, 2);
        assert.ok(translator2DModule.Translator2D.firstCall.args[0]);
        assert.ok(translator2DModule.Translator2D.secondCall.args[0]);
        assert.ok(translator2DModule.Translator2D.firstCall.args[1]);
        assert.ok(translator2DModule.Translator2D.secondCall.args[1]);
        assert.deepEqual(translator2DModule.Translator2D.firstCall.args[2], { isHorizontal: true });
        assert.deepEqual(translator2DModule.Translator2D.secondCall.args[2], undefined);
    });

    QUnit.test('Create line series with default options', function(assert) {
        this.createSparkline({
            dataSource: [4, 4, 8, 7, 9, 5, 4, 6, 1, 2, 3, 0, 5, 6, 4, 8, 9, 5, 6, 1, 2, 3, 4, 5, 6, 8, 4, 6]
        });

        var options = this.getSeriesOptions();

        assert.ok(seriesModule.Series.called);
        assert.deepEqual(options, {
            argumentField: "arg",
            border: {
                color: "#666666",
                visible: true,
                width: 2
            },
            color: "#666666",
            customizePoint: options.customizePoint,
            opacity: undefined,
            point: {
                border: {
                    visible: true,
                    width: 2
                },
                color: "#ffffff",
                hoverStyle: {
                    border: {}
                },
                selectionStyle: {
                    border: {}
                },
                size: 4,
                symbol: "circle",
                visible: false
            },
            type: "line",
            valueField: "val",
            visible: true,
            widgetType: "chart",
            width: 2
        });
    });

    QUnit.test('Create line series with custom options', function(assert) {
        this.createSparkline({
            dataSource: [4, 4, 8, 7, 9, 5, 4, 6, 1, 2, 3, 0, 5, 6, 4, 8, 9, 5, 6, 1, 2, 3, 4, 5, 6, 8, 4, 6],
            lineColor: 'blue',
            lineWidth: 3,
            pointSize: 7
        });

        var options = this.getSeriesOptions();

        assert.ok(seriesModule.Series.called);
        assert.deepEqual(options, {
            argumentField: "arg",
            border: {
                color: "blue",
                visible: true,
                width: 3
            },
            color: "blue",
            customizePoint: options.customizePoint,
            opacity: undefined,
            point: {
                border: {
                    visible: true,
                    width: 2
                },
                color: "#ffffff",
                hoverStyle: {
                    border: {}
                },
                selectionStyle: {
                    border: {}
                },
                size: 7,
                symbol: "circle",
                visible: false
            },
            type: "line",
            valueField: "val",
            visible: true,
            widgetType: "chart",
            width: 3
        });
    });

    QUnit.test('Create line series with circle point', function(assert) {
        this.createSparkline({
            dataSource: [4, 4, 8, 7, 9, 5, 4, 6, 1, 2, 3, 0, 5, 6, 4, 8, 9, 5, 6, 1, 2, 3, 4, 5, 6, 8, 4, 6]
        });

        var options = this.getSeriesOptions();
        assert.ok(seriesModule.Series.called);
        assert.equal(options.point.symbol, "circle");
    });

    QUnit.test('Create line series with square point', function(assert) {
        this.createSparkline({
            dataSource: [4, 4, 8, 7, 9, 5, 4, 6, 1, 2, 3, 0, 5, 6, 4, 8, 9, 5, 6, 1, 2, 3, 4, 5, 6, 8, 4, 6],
            pointSymbol: 'square'
        });

        var options = this.getSeriesOptions();
        assert.ok(seriesModule.Series.called);
        assert.equal(options.point.symbol, "square");
    });

    QUnit.test('Create line series with cross point', function(assert) {
        this.createSparkline({
            dataSource: [4, 4, 8, 7, 9, 5, 4, 6, 1, 2, 3, 0, 5, 6, 4, 8, 9, 5, 6, 1, 2, 3, 4, 5, 6, 8, 4, 6],
            pointSymbol: 'cross'
        });

        var options = this.getSeriesOptions();
        assert.ok(seriesModule.Series.called);
        assert.equal(options.point.symbol, "cross");
    });

    QUnit.test('Create line series with polygon point', function(assert) {
        this.createSparkline({
            dataSource: [4, 4, 8, 7, 9, 5, 4, 6, 1, 2, 3, 0, 5, 6, 4, 8, 9, 5, 6, 1, 2, 3, 4, 5, 6, 8, 4, 6],
            pointSymbol: 'polygon'
        });

        var options = this.getSeriesOptions();
        assert.ok(seriesModule.Series.called);
        assert.equal(options.point.symbol, "polygon");
    });

    QUnit.test('Create spline series', function(assert) {
        this.createSparkline({
            type: 'spline',
            dataSource: [4, 4, 8, 7, 9, 5, 4, 6, 1, 2, 3, 0, 5, 6, 4, 8, 9, 5, 6, 1, 2, 3, 4, 5, 6, 8, 4, 6]
        });

        var options = this.getSeriesOptions();
        assert.ok(seriesModule.Series.called);
        assert.equal(options.type, "spline");
    });

    QUnit.test('Create stepline series', function(assert) {
        this.createSparkline({
            type: 'stepline',
            dataSource: [4, 4, 8, 7, 9, 5, 4, 6, 1, 2, 3, 0, 5, 6, 4, 8, 9, 5, 6, 1, 2, 3, 4, 5, 6, 8, 4, 6]
        });

        var options = this.getSeriesOptions();
        assert.ok(seriesModule.Series.called);
        assert.equal(options.type, "stepline");
    });

    QUnit.test('Create area series with default options', function(assert) {
        this.createSparkline({
            type: 'area',
            dataSource: [4, 4, 8, 7, 9, 5, 4, 6, 1, 2, 3, 0, 5, 6, 4, 8, 9, 5, 6, 1, 2, 3, 4, 5, 6, 8, 4, 6]
        });

        var options = this.getSeriesOptions();

        assert.ok(seriesModule.Series.called);
        assert.deepEqual(options, {
            argumentField: "arg",
            border: {
                color: "#666666",
                visible: true,
                width: 2
            },
            color: "#666666",
            customizePoint: options.customizePoint,
            opacity: 0.2,
            point: {
                border: {
                    visible: true,
                    width: 2
                },
                color: "#ffffff",
                hoverStyle: {
                    border: {}
                },
                selectionStyle: {
                    border: {}
                },
                size: 4,
                symbol: "circle",
                visible: false
            },
            type: "area",
            valueField: "val",
            visible: true,
            widgetType: "chart",
            width: 2
        });
    });

    QUnit.test('Create area series with custom options', function(assert) {
        this.createSparkline({
            type: 'area',
            lineColor: 'yellow',
            lineWidth: 5,
            dataSource: [4, 4, 8, 7, 9, 5, 4, 6, 1, 2, 3, 0, 5, 6, 4, 8, 9, 5, 6, 1, 2, 3, 4, 5, 6, 8, 4, 6]
        });

        var options = this.getSeriesOptions();

        assert.ok(seriesModule.Series.called);
        assert.deepEqual(options, {
            argumentField: "arg",
            border: {
                color: "yellow",
                visible: true,
                width: 5
            },
            color: "yellow",
            customizePoint: options.customizePoint,
            opacity: 0.2,
            point: {
                border: {
                    visible: true,
                    width: 2
                },
                color: "#ffffff",
                hoverStyle: {
                    border: {}
                },
                selectionStyle: {
                    border: {}
                },
                size: 4,
                symbol: "circle",
                visible: false
            },
            type: "area",
            valueField: "val",
            visible: true,
            widgetType: "chart",
            width: 5
        });
    });

    QUnit.test('Create splinearea series', function(assert) {
        this.createSparkline({
            type: 'splinearea',
            dataSource: [4, 4, 8, 7, 9, 5, 4, 6, 1, 2, 3, 0, 5, 6, 4, 8, 9, 5, 6, 1, 2, 3, 4, 5, 6, 8, 4, 6]
        });

        var options = this.getSeriesOptions();
        assert.ok(seriesModule.Series.called);
        assert.equal(options.type, "splinearea");
    });

    QUnit.test('Create steparea series', function(assert) {
        this.createSparkline({
            type: 'steparea',
            dataSource: [4, 4, 8, 7, 9, 5, 4, 6, 1, 2, 3, 0, 5, 6, 4, 8, 9, 5, 6, 1, 2, 3, 4, 5, 6, 8, 4, 6]
        });

        var options = this.getSeriesOptions();
        assert.ok(seriesModule.Series.called);
        assert.equal(options.type, "steparea");
    });

    QUnit.test('Create bar series with default options', function(assert) {
        this.createSparkline({
            type: 'bar',
            dataSource: [4, 4, 8, 7, 9, 5, 4, 6, 1, 2, 3, 0, 5, 6, 4, 8, 9, 5, 6, 1, 2, 3, 4, 5, 6, 8, 4, 6]
        });

        var options = this.getSeriesOptions();

        assert.ok(seriesModule.Series.called);
        assert.deepEqual(options, {
            argumentField: "arg",
            border: {
                color: "#666666",
                visible: false,
                width: 2
            },
            color: "#666666",
            customizePoint: options.customizePoint,
            opacity: undefined,
            point: {
                border: {
                    visible: true,
                    width: 2
                },
                color: "#ffffff",
                hoverStyle: {
                    border: {}
                },
                selectionStyle: {
                    border: {}
                },
                size: 4,
                symbol: "circle",
                visible: false
            },
            type: "bar",
            valueField: "val",
            visible: true,
            widgetType: "chart",
            width: 2
        });
    });

    QUnit.test('Create winloss series', function(assert) {
        this.createSparkline({
            type: 'winloss',
            dataSource: [4, 4, 8, 7, 9, 5, 4, 6, 1, 2, 3, 0, 5, 6, 4, 8, 9, 5, 6, 1, 2, 3, 4, 5, 6, 8, 4, 6]
        });

        var options = this.getSeriesOptions();

        assert.ok(seriesModule.Series.called);
        assert.deepEqual(options, {
            argumentField: "arg",
            border: {
                color: "#666666",
                visible: false,
                width: 2
            },
            color: "#666666",
            customizePoint: options.customizePoint,
            opacity: undefined,
            point: {
                border: {
                    visible: true,
                    width: 2
                },
                color: "#ffffff",
                hoverStyle: {
                    border: {}
                },
                selectionStyle: {
                    border: {}
                },
                size: 4,
                symbol: "circle",
                visible: false
            },
            type: "bar",
            valueField: "val",
            visible: true,
            widgetType: "chart",
            width: 2
        });
    });

    QUnit.test('check series dispose', function(assert) {
        this.createSparkline({
            dataSource: [1, 2, 3, 4]
        });

        this.$container.remove();
        assert.ok(this.series.dispose.calledOnce);
    });

    QUnit.test('Refresh', function(assert) {
        var options = {
                dataSource: [4, 8, 6, 9, 4],
                type: 'area',
                color: '#448ff4',
                width: 2,
                mode: 'minMax'
            },
            sparkline = this.createSparkline(options);

        this.renderer.resize.reset();

        this.$container.width(300);
        this.$container.height(40);
        sparkline.render();

        assert.equal(this.getCanvas().width, 300, 'Canvas width should have new value');
        assert.equal(this.getCanvas().height, 40, 'Canvas height should have new value');

        assert.equal(this.getSeriesOptions().type, 'area', 'Sparkline should have old type');

        assert.equal(this.renderer.resize.callCount, 1);
        assert.deepEqual(this.renderer.resize.firstCall.args, [300, 40], 'Pass changed canvas width and height to renderer');
    });

    QUnit.test('Change size of container', function(assert) {
        var sparkline = this.createSparkline({
            dataSource: [4, 8, 6, 9, 1, 3, 5, 6, 1, 2, 5, 4]
        });

        this.renderer.resize.reset();

        sparkline.option('size', { width: 300, height: 100 });

        assert.equal(this.getCanvas().width, 300, 'Canvas should have new width');
        assert.equal(this.getCanvas().height, 100, 'Canvas should have new height');

        assert.equal(this.renderer.resize.callCount, 1);
        assert.deepEqual(this.renderer.resize.firstCall.args, [300, 100], 'Pass changed canvas width and height to renderer');
    });

    QUnit.test('B239673 - Tooltip does not update location after resize', function(assert) {
        var sparkline = this.createSparkline({
            dataSource: [4]
        });
        sparkline._showTooltipCallback();

        sparkline.option('size', { width: 300, height: 100 });
        assert.ok(sparkline._tooltip.hide.calledOnce, 'Tooltip should be hidden');
    });

    QUnit.test('Change datasource', function(assert) {
        var sparkline = this.createSparkline({
            dataSource: [4, 8, 6, 9, 1, 3, 5, 6, 1, 2, 5, 4]
        });
        sparkline.option({ dataSource: [1, 1, 1, 1] });

        var data = seriesModule.Series.lastCall.returnValue.updateData.lastCall.args[0];

        assert.equal(data[0].arg, '0', 'Data source should be correct');
        assert.equal(data[0].val, 1, 'Data source should be correct');
        assert.equal(data[1].arg, '1', 'Data source should be correct');
        assert.equal(data[1].val, 1, 'Data source should be correct');
        assert.equal(data[2].arg, '2', 'Data source should be correct');
        assert.equal(data[2].val, 1, 'Data source should be correct');
        assert.equal(data[3].arg, '3', 'Data source should be correct');
        assert.equal(data[3].val, 1, 'Data source should be correct');
        assert.equal(data.length, 4, 'Series should have new 4 points');
        assert.ok(seriesModule.Series.calledOnce);
    });

    QUnit.test('Change type', function(assert) {
        var sparkline = this.createSparkline({
            dataSource: [4, 8, 6, 9, 1, 3, 5, 6, 1, 2, 5, 4]
        });

        sparkline.option('type', 'bar');

        assert.equal(this.getSeriesOptions().type, 'bar');
        assert.ok(seriesModule.Series.calledOnce);
    });

    QUnit.test('Change size - B239871', function(assert) {
        var sparkline = this.createSparkline({
            dataSource: [4, 8, 6, 9, 1, 3, 5, 6, 1, 2, 5, 4]
        });

        sparkline.option('size', { width: 200, height: 150 });

        assert.ok(this.series.draw.calledTwice, 'Redraw function was called');
    });

    QUnit.test('Change size if size = 0,0 - B239871', function(assert) {
        var sparkline = this.createSparkline({
            dataSource: [4, 8, 6, 9, 1, 3, 5, 6, 1, 2, 5, 4],
            size: {
                width: 0,
                height: 0
            }
        });

        sparkline.option('size', { width: 200, height: 150 });

        assert.ok(this.series.draw.calledTwice, 'Redraw function was not called');
    });

    QUnit.test('Change size if size = 10,0 - B239871', function(assert) {
        var sparkline = this.createSparkline({
            dataSource: [4, 8, 6, 9, 1, 3, 5, 6, 1, 2, 5, 4],
            size: {
                width: 10,
                height: 0
            }
        });

        sparkline.option('size', { width: 200, height: 150 });

        assert.ok(this.series.draw.calledTwice, 'Redraw function was not called');
    });

    QUnit.test('Change size if size = 0,10 - B239871', function(assert) {
        var sparkline = this.createSparkline({
            dataSource: [4, 8, 6, 9, 1, 3, 5, 6, 1, 2, 5, 4],
            size: {
                width: 0,
                height: 10
            }
        });

        sparkline.option('size', { width: 200, height: 150 });

        assert.ok(this.series.draw.calledTwice, 'Redraw function was not called');
    });

    QUnit.test('Resize empty sparkline', function(assert) {
        var sparkline = this.createSparkline({});

        sparkline.option('size', { width: 200 });

        assert.equal(this.getCanvas().width, 200, 'Width was corrected');
    });

    QUnit.test('Change datasource with small container. B254479', function(assert) {
        var sparkline = this.createSparkline({
            size: {
                width: 3
            }
        });

        sparkline.option('dataSource', []);

        assert.ok(true, 'dxSparkline was not broken');
    });

    //T422022
    QUnit.test("sparkline contains export methods", function(assert) {
        var sparkline = this.createSparkline({});

        assert.ok($.isFunction(sparkline.exportTo));
    });

    QUnit.module('drawn', {
        beforeEach: function() {
            environment.beforeEach.call(this);
            sinon.stub(BaseWidget.prototype, '_drawn', sinon.spy());
        },
        afterEach: function() {
            environment.afterEach.call(this);
            BaseWidget.prototype._drawn.restore();
        },
        createSparkline: environment.createSparkline
    });

    QUnit.test('drawn is called', function(assert) {
        this.createSparkline({ dataSource: [4, 8, 6] });

        assert.strictEqual(BaseWidget.prototype._drawn.calledOnce, true);
    });

    QUnit.test('drawn is called after dataSource changing', function(assert) {
        var sparkline = this.createSparkline(0);

        sparkline.option("dataSource", [4]);

        assert.strictEqual(BaseWidget.prototype._drawn.calledTwice, true);
    });

    QUnit.test('drawn is called after resize', function(assert) {
        var sparkline = this.createSparkline({ dataSource: [3] });

        sparkline.option("size", { width: 300 });

        assert.strictEqual(BaseWidget.prototype._drawn.calledTwice, true);
    });

    QUnit.module('drawn with async data', {
        beforeEach: function() {
            environment.beforeEach.call(this);
            sinon.stub(BaseWidget.prototype, '_drawn', sinon.spy());
            this.data = new dataSourceModule.DataSource();
            this.isLoadedStub = sinon.stub(this.data, "isLoaded");
        },
        afterEach: function() {
            environment.afterEach.call(this);
            BaseWidget.prototype._drawn.restore();
        },
        createSparkline: environment.createSparkline
    });

    QUnit.test('drawn is called with starting with async data', function(assert) {
        this.isLoadedStub.returns(false);

        this.createSparkline({ dataSource: this.data });

        assert.ok(!BaseWidget.prototype._drawn.called);
    });

    QUnit.test('drawn is called with ending with async data', function(assert) {
        this.isLoadedStub.returns(true);

        this.createSparkline({ dataSource: this.data });

        assert.strictEqual(BaseWidget.prototype._drawn.calledOnce, true);
    });

    QUnit.module('isReady', environment);

    QUnit.test('isReady without data', function(assert) {
        var sparkline = this.createSparkline({});

        this.renderer.onEndAnimation.lastCall.args[0]();

        assert.ok(sparkline.isReady());
    });

    QUnit.test('isReady with data', function(assert) {
        var sparkline = this.createSparkline({ value: 10, dataSource: null });

        this.renderer.onEndAnimation.lastCall.args[0]();

        assert.ok(sparkline.isReady());
    });

    QUnit.test('isReady with not loaded dataSource', function(assert) {
        var data = new dataSourceModule.DataSource();
        sinon.stub(data, "isLoaded", function() { return false; });

        var sparkline = this.createSparkline({ dataSource: data });

        this.renderer.stub("onEndAnimation", function(callback) { callback(); });
        sparkline.render();

        assert.strictEqual(sparkline.isReady(), false);
    });

    QUnit.module("incidentOccurred", getEnvironmentWithStubValidateData());

    QUnit.test("check incidentOccurred passed to validateData", function(assert) {
        var incSpy = sinon.spy();

        this.createSparkline({
            onIncidentOccurred: incSpy
        });
        dataValidatorModule.validateData.lastCall.args[2]("E202");
        this.forceTimeout();

        assert.ok(incSpy.called);
    });

    QUnit.module("dataSource integration", environment);

    QUnit.test("dataSource creation", function(assert) {
        var widget = this.createSparkline({ dataSource: [1, 2, 3] }),
            ds = widget.getDataSource();

        assert.ok(ds instanceof dataSourceModule.DataSource);
        assert.ok(ds.isLoaded());
        assert.deepEqual(ds.items(), [1, 2, 3]);
    });

    QUnit.test("data initialization after load dataSource", function(assert) {
        this.createSparkline({ dataSource: [] });

        assert.equal(seriesModule.Series.callCount, 1);
        assert.equal(seriesModule.Series.lastCall.returnValue.updateData.callCount, 1);
    });

    QUnit.test("update dataSource after option changing", function(assert) {
        var widget = this.createSparkline({});

        widget.option("dataSource", [1, 2, 3]);

        assert.deepEqual(widget.getDataSource().items(), [1, 2, 3]);
    });
});

