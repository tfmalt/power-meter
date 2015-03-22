/**
 * Created by tm on 21/03/15.
 *
 * @author tm
 * @copyright 2015 (c) tm
 */

var chai    = require('chai'),
    expect  = chai.expect,
    promise = require('chai-as-promised'),
    power   = require('../lib/power'),
    redis   = require('fakeredis'),
    pj      = require('../package.json'),
    ctrl    = power.controller;

chai.should();
chai.use(promise);

describe('Power Meter API Controller', function() {
    "use strict";
    beforeEach(function() {
        ctrl.read  = redis.createClient();
        ctrl.write = ctrl.read;
    });

    it('should have a valid version', function() {
        ctrl.version.should.be.a('string');
    });

    it('should have have a valid read redis client', function() {
        ctrl.read.should.exist;
        ctrl.read.should.be.an.instanceOf(redis.RedisClient);
    });
    describe('watts.hour.get', function() {
        beforeEach(function(done) {
            for(var i = 0; i <= 3600; i++) {
                ctrl.write.rpush(
                    "hour",
                    "{\"pulseCount\": 17, \"timestamp\": " + (i*1000) + "}"
                );
            }
            done();
        });

        it('watts hour get should return valid json', function() {
            return expect(ctrl.watts.hour.get()).to.eventually.contain.keys(
                'description',
                'version',
                'items',
                'container');
        });
    });

    describe('watts.get', function() {
        beforeEach(function(done) {
            for(var i = 0; i <= 5; i++) {
                ctrl.write.rpush(
                    "hour",
                    "{\"pulseCount\": 17, \"timestamp\": " + (i*1000) + "}"
                );
            }
            done();
        });

        it('should be rejected when passed no arguments', function () {
            return ctrl.watts.get().should.eventually.deep.equal({
                average: 17,
                description: "Current Usage in Watts",
                interval: 1,
                kWhs: 0.0017,
                sum: 17,
                version: pj.version,
                watt: 6119
            });
        });

        it('should return correct json when called correctly', function() {
            return ctrl.watts.get(5).should.eventually.deep.equal({
                average: 17,
                description: "Current Usage in Watts",
                interval: 5,
                kWhs: 0.0017,
                sum: 85,
                version: pj.version,
                watt: 6119
            });
        });
    });

    describe('kwh.handler', function() {
        var now = new Date();
        var hourTime;
        var dayTime;

        beforeEach(function(done) {
            hourTime = ctrl.normalizeDate(new Date, "hour");
            dayTime  = ctrl.normalizeDate(new Date, "day");

            for(var i = 0; i <= 30; i++) {
                ctrl.write.lpush(
                    "day",
                    "{\"total\": 300, \"timestamp\": " + (now.getTime() - (i*1000)) + "}"
                );
                ctrl.write.set("hour:" + hourTime.toJSON(), JSON.stringify({
                    timestamp: hourTime.getTime(),
                    datestr: hourTime.toJSON(),
                    total: 12345,
                    kwh: 1.2345
                }));

                ctrl.write.set("day:" + dayTime.toJSON(), JSON.stringify({
                    timestamp: dayTime.getTime(),
                    timestr: dayTime.toJSON(),
                    total: 80000,
                    kwh: 80.000
                }));

                dayTime  = new Date(dayTime.getTime() - 24*60*60*1000);
                hourTime = new Date(hourTime.getTime() - 60*60*1000);
            }

            ctrl.write.lpush(
                "day",
                "{\"total\": 300, \"timestamp\": " + (now.getTime() - 24*60*60*1000) + "}"
            );
            done();
        });

        it('should return correct json for watt today', function() {
            return ctrl.kwh.handler("today").should.eventually.deep.equal({
                date: (new Date(hourTime.getTime() + 12*60*60*1000)).toJSON(),
                description: "kWh used today from midnight to now.",
                kwh: parseFloat(((now.getHours() -1) * 0.0517).toFixed(2)),
                version: pj.version
            });
        });

        it('should throw TypeError on incorrect type.', function() {
            ctrl.kwh.handler.bind(ctrl, "popeye").should.throw(TypeError, /first argument/);
        });

        it('should throw TypeError when missing count', function() {
            ctrl.kwh.handler.bind(ctrl, "hour").should.throw(TypeError, /second argument/);
        });

        it('should return correct json for 1 hour', function() {
            return ctrl.kwh.handler("hour", 1).should.eventually.deep.equal({
                description: "kWh consumed per hour for 1 hours",
                items: [{
                    date: (new Date(hourTime.getTime() + 31*60*60*1000)).toJSON(),
                    kwh: 1.2345,
                    timestamp: (new Date(hourTime.getTime() + 31*60*60*1000)).getTime(),
                    total: 12345
                }],
                version: pj.version
            });
        });

        it('should return correct json for 1 day', function() {
            return ctrl.kwh.handler("day", 1).should.eventually.deep.equal({
                description: "kWh consumed per day for 1 days",
                items: [{
                    date: (new Date(dayTime.getTime() + 31*24*60*60*1000)).toJSON(),
                    kwh: 80,
                    timestamp: (new Date(dayTime.getTime() + 31*24*60*60*1000)).getTime(),
                    total: 80000
                }],
                version: pj.version
            });
        });

    });
});