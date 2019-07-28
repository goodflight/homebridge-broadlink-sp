var Service, Characteristic;
var broadlink = require('./broadlinkjs');
const { version } = require("./package.json");

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-kb-broadlink-sp", "kb_broadlinkSP", kb_broadlinkSP);
}

function kb_broadlinkSP(log, config, api) {
    
    this.ip = config['ip'];
    this.name = config['name'];
    this.mac = config['mac'];
    this.serialNumber = config.serialNumber || '';


    this.timeoutStep = 300;

    if(config['timeout']){
        this.stepsCount = Math.round(config['timeout']/this.timeoutStep);
    }else{
        this.stepsCount = 5;
    }


    this.powered = false;
    this.log = log;
    this.updateTimeout   = config.updateTimeout || 30000;

    if (!this.ip && !this.mac) throw new Error("You must provide a config value for 'ip' or 'mac'.");

    // MAC string to MAC buffer
    this.mac_buff = function(mac) {
        var mb = new Buffer(6);
        if (mac) {
            var values = mac.split(':');
            if (!values || values.length !== 6) {
                throw new Error('Invalid MAC [' + mac + ']; should follow pattern ##:##:##:##:##:##');
            }
            for (var i = 0; i < values.length; ++i) {
                var tmpByte = parseInt(values[i], 16);
                mb.writeUInt8(tmpByte, i);
            }
        } else {
            //this.log("MAC address emtpy, using IP: " + this.ip);
        }
        return mb;
    }

    this.service = new Service.Switch(this.name);

    this.service.getCharacteristic(Characteristic.On)
        .on('get', this.getState.bind(this))
        .on('set', this.setState.bind(this))
    ;

    this.accessoryInformationService = new Service.AccessoryInformation()
        .setCharacteristic(Characteristic.Manufacturer, 'Broadlink')
        .setCharacteristic(Characteristic.Model, 'SP')
        .setCharacteristic(Characteristic.SerialNumber, this.serialNumber)
        .setCharacteristic(Characteristic.FirmwareRevision, version)
    ;
}

kb_broadlinkSP.prototype.getState = function(callback) {
    var self = this

    var real_result = -1;
    var step = 0;

    var callbackStep = function(){
        setTimeout(function(){
            if(-1 != real_result){
                self.log("real_result get SP state: " + real_result, ", step:", step);
                callback(null, real_result);
            }else if(step < self.stepsCount){
                step++;
                callbackStep();
            }else{
                self.log("old_result get SP state: " + self.powered, ", step:", step);
                callback(null, self.powered);
            }
        }, self.timeoutStep);
    };

    callbackStep();


    var b = new broadlink();
   
    b.on("deviceReady", (dev) => {
        if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
            dev.check_power();
            dev.on("power", (pwr) => {
                self.log("power is on - " + pwr);
                dev.exit();
                if (!pwr) {
                    self.powered = false;
                } else {
                    self.powered = true;
                }

                real_result = !!self.powered;
                
            });
        } else {
            dev.exit();
            
        }
    });

    b.discover(self.ip, self.log);
    
};

kb_broadlinkSP.prototype.setState = function(state, callback) {
    var self = this

    var real_result = -1;
    var step = 0;

    var callbackStep = function(){
        setTimeout(function(){
            if(-1 != real_result){
                self.log("real_result set SP state, step:", step);
                callback(null);
            }else if(step < self.stepsCount){
                step++;
                callbackStep();
            }else{
                self.log("err_result set SP state, step:", step);
                callback('error');
            }
        }, self.timeoutStep);
    };

    callbackStep();
   
    var b = new broadlink();
 
    
    b.on("deviceReady", (dev) => {
       
        if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {

            dev.set_power(state);
            dev.exit();
            self.powered = state;
            real_result = true;
            
        } else {
            dev.exit();
        }
    });

    b.discover(self.ip, self.log);

};

kb_broadlinkSP.prototype.getServices = function() {
    var that = this; 

    return [
        this.service,
        this.accessoryInformationService
    ]
};