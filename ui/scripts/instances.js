// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.
(function($, cloudStack) {
    var vmMigrationHostObjs;
    cloudStack.sections.instances = {
        title: 'label.instances',
        id: 'instances',
        listView: {
            section: 'instances',
            filters: {
                all: {
                    label: 'ui.listView.filters.all'
                },
                mine: {
                    label: 'ui.listView.filters.mine'
                },
                running: {
                    label: 'state.Running'
                },
                stopped: {
                    label: 'state.Stopped'
                },
                destroyed: {
                    preFilter: function(args) {
                        if (isAdmin() || isDomainAdmin())
                            return true;
                        else
                            return false;
                    },
                    label: 'state.Destroyed'
                }
            },
            preFilter: function(args) {
                var hiddenFields = [];
                if (!isAdmin()) {
                    hiddenFields.push('instancename');
                }
                return hiddenFields;
            },
            fields: {
                name: {
                    label: 'label.name'
                },
                instancename: {
                    label: 'label.internal.name'
                },
                displayname: {
                    label: 'label.display.name'
                },
                zonename: {
                    label: 'label.zone.name'
                },
                state: {
                    label: 'label.state',
                    indicator: {
                        'Running': 'on',
                        'Stopped': 'off',
                        'Destroyed': 'off',
                        'Error': 'off'
                    }
                }
            },

            advSearchFields: {
                name: {
                    label: 'Name'
                },
                zoneid: {
                    label: 'Zone',
                    select: function(args) {
                        $.ajax({
                            url: createURL('listZones'),
                            data: {
                                listAll: true
                            },
                            success: function(json) {
                                var zones = json.listzonesresponse.zone ? json.listzonesresponse.zone : [];

                                args.response.success({
                                    data: $.map(zones, function(zone) {
                                        return {
                                            id: zone.id,
                                            description: zone.name
                                        };
                                    })
                                });
                            }
                        });
                    }
                },

                domainid: {
                    label: 'Domain',
                    select: function(args) {
                        if (isAdmin() || isDomainAdmin()) {
                            $.ajax({
                                url: createURL('listDomains'),
                                data: {
                                    listAll: true,
                                    details: 'min'
                                },
                                success: function(json) {
                                    var array1 = [{
                                        id: '',
                                        description: ''
                                    }];
                                    var domains = json.listdomainsresponse.domain;
                                    if (domains != null && domains.length > 0) {
                                        for (var i = 0; i < domains.length; i++) {
                                            array1.push({
                                                id: domains[i].id,
                                                description: domains[i].path
                                            });
                                        }
                                    }
                                    args.response.success({
                                        data: array1
                                    });
                                }
                            });
                        } else {
                            args.response.success({
                                data: null
                            });
                        }
                    },
                    isHidden: function(args) {
                        if (isAdmin() || isDomainAdmin())
                            return false;
                        else
                            return true;
                    }
                },
                account: {
                    label: 'Account',
                    isHidden: function(args) {
                        if (isAdmin() || isDomainAdmin())
                            return false;
                        else
                            return true;
                    }
                },

                tagKey: {
                    label: 'Tag Key'
                },
                tagValue: {
                    label: 'Tag Value'
                }
            },

            // List view actions
            actions: {
                // Add instance wizard
                add: {
                    label: 'label.vm.add',

                    action: {
                        custom: cloudStack.uiCustom.instanceWizard(cloudStack.instanceWizard)
                    },

                    messages: {
                        notification: function(args) {
                            return 'label.vm.add';
                        }
                    },
                    notification: {
                        poll: pollAsyncJobResult
                    }
                }
            },

            dataProvider: function(args) {
                var data = {};
                listViewDataProvider(args, data);

                if (args.filterBy != null) { //filter dropdown
                    if (args.filterBy.kind != null) {
                        switch (args.filterBy.kind) {
                            case "all":
                                break;
                            case "mine":
                                if (!args.context.projects) {
                                    $.extend(data, {
                                        domainid: g_domainid,
                                        account: g_account
                                    });
                                }
                                break;
                            case "running":
                                $.extend(data, {
                                    state: 'Running'
                                });
                                break;
                            case "stopped":
                                $.extend(data, {
                                    state: 'Stopped'
                                });
                                break;
                            case "destroyed":
                                $.extend(data, {
                                    state: 'Destroyed'
                                });
                                break;
                        }
                    }
                }

                if ("hosts" in args.context) {
                    $.extend(data, {
                        hostid: args.context.hosts[0].id
                    });
                }

                if ("affinityGroups" in args.context) {
                    $.extend(data, {
                        affinitygroupid: args.context.affinityGroups[0].id
                    });
                }

                if ("vpc" in args.context &&
                    "networks" in args.context) {
                    $.extend(data, {
                        vpcid: args.context.vpc[0].id,
                        networkid: args.context.networks[0].id
                    });
                }

                $.ajax({
                    url: createURL('listVirtualMachines'),
                    data: data,
                    success: function(json) {
                        var items = json.listvirtualmachinesresponse.virtualmachine;
                        args.response.success({
                            actionFilter: vmActionfilter,
                            data: items
                        });
                    }
                });
            },

            detailView: {
                name: 'Instance details',
                viewAll: [{
                    path: 'storage.volumes',
                    label: 'label.volumes'
                }, {
                    path: 'vmsnapshots',
                    label: 'label.snapshots'
                }, {
                    path: 'affinityGroups',
                    label: 'label.affinity.groups'
                }, {
                    path: '_zone.hosts',
                    label: 'label.hosts',
                    preFilter: function(args) {
                        return isAdmin();
                    },
                    updateContext: function(args) {
                        var instance = args.context.instances[0];
                        var zone;

                        $.ajax({
                            url: createURL('listZones'),
                            data: {
                                id: instance.zoneid
                            },
                            async: false,
                            success: function(json) {
                                zone = json.listzonesresponse.zone[0]
                            }
                        });

                        return {
                            zones: [zone]
                        };
                    }
                }],
                tabFilter: function(args) {
                    var hiddenTabs = [];

                    var zoneObj;
                    $.ajax({
                        url: createURL("listZones&id=" + args.context.instances[0].zoneid),
                        dataType: "json",
                        async: false,
                        success: function(json) {
                            zoneObj = json.listzonesresponse.zone[0];
                        }
                    });

                    var includingSecurityGroupService = false;
                    if (zoneObj.networktype == "Basic") { //Basic zone
                        $.ajax({
                            url: createURL("listNetworks&id=" + args.context.instances[0].nic[0].networkid),
                            dataType: "json",
                            async: false,
                            success: function(json) {
                                var items = json.listnetworksresponse.network;
                                if (items != null && items.length > 0) {
                                    var networkObj = items[0]; //Basic zone has only one guest network (only one NIC)
                                    var serviceObjArray = networkObj.service;
                                    for (var k = 0; k < serviceObjArray.length; k++) {
                                        if (serviceObjArray[k].name == "SecurityGroup") {
                                            includingSecurityGroupService = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        });
                    } else if (zoneObj.networktype == "Advanced") { //Advanced zone
                        if (zoneObj.securitygroupsenabled == true)
                            includingSecurityGroupService = true;
                        else
                            includingSecurityGroupService = false;
                    }

                    if (includingSecurityGroupService == false) {
                        hiddenTabs.push("securityGroups");
                    }

                    return hiddenTabs;
                },
                actions: {
                    start: {
                        label: 'label.action.start.instance',
                        action: function(args) {
                            $.ajax({
                                url: createURL("startVirtualMachine&id=" + args.context.instances[0].id),
                                dataType: "json",
                                async: true,
                                success: function(json) {
                                    var jid = json.startvirtualmachineresponse.jobid;
                                    args.response.success({
                                        _custom: {
                                            jobId: jid,
                                            getUpdatedItem: function(json) {
                                                return json.queryasyncjobresultresponse.jobresult.virtualmachine;
                                            },
                                            getActionFilter: function() {
                                                return vmActionfilter;
                                            }
                                        }
                                    });
                                }
                            });
                        },
                        messages: {
                            confirm: function(args) {
                                return 'message.action.start.instance';
                            },
                            notification: function(args) {
                                return 'label.action.start.instance';
                            },
                            complete: function(args) {
                                if (args.password != null) {
                                    return 'Password of the VM is ' + args.password;
                                }

                                return false;
                            }
                        },
                        notification: {
                            poll: pollAsyncJobResult
                        }
                    },
                    stop: {
                        label: 'label.action.stop.instance',
                        compactLabel: 'label.stop',
                        createForm: {
                            title: 'Stop instance',
                            desc: 'message.action.stop.instance',
                            fields: {
                                forced: {
                                    label: 'force.stop',
                                    isBoolean: true,
                                    isChecked: false
                                }
                            }
                        },
                        action: function(args) {
                            var array1 = [];
                            array1.push("&forced=" + (args.data.forced == "on"));
                            $.ajax({
                                url: createURL("stopVirtualMachine&id=" + args.context.instances[0].id + array1.join("")),
                                dataType: "json",
                                async: true,
                                success: function(json) {
                                    var jid = json.stopvirtualmachineresponse.jobid;
                                    args.response.success({
                                        _custom: {
                                            jobId: jid,
                                            getUpdatedItem: function(json) {
                                                return json.queryasyncjobresultresponse.jobresult.virtualmachine;
                                            },
                                            getActionFilter: function() {
                                                return vmActionfilter;
                                            }
                                        }
                                    });
                                }
                            });
                        },
                        messages: {
                            confirm: function(args) {
                                return 'message.action.stop.instance';
                            },
                            notification: function(args) {
                                return 'label.action.stop.instance';
                            }
                        },
                        notification: {
                            poll: pollAsyncJobResult
                        }
                    },
                    restart: {
                        label: 'label.action.reboot.instance',
                        compactLabel: 'label.reboot',
                        action: function(args) {
                            $.ajax({
                                url: createURL("rebootVirtualMachine&id=" + args.context.instances[0].id),
                                dataType: "json",
                                async: true,
                                success: function(json) {
                                    var jid = json.rebootvirtualmachineresponse.jobid;
                                    args.response.success({
                                        _custom: {
                                            jobId: jid,
                                            getUpdatedItem: function(json) {
                                                return json.queryasyncjobresultresponse.jobresult.virtualmachine;
                                            },
                                            getActionFilter: function() {
                                                return vmActionfilter;
                                            }
                                        }
                                    });
                                }
                            });
                        },
                        messages: {
                            confirm: function(args) {
                                return 'message.action.reboot.instance';
                            },
                            notification: function(args) {
                                return 'label.action.reboot.instance';
                            },
                            complete: function(args) {
                            	if (args.password != null && args.password.length > 0)
                                    return 'Password has been reset to ' + args.password;
                            	else
                            		return null;
                            }
                        },
                        notification: {
                            poll: pollAsyncJobResult
                        }
                    },
                    snapshot: {
                        messages: {
                            notification: function(args) {
                                return 'label.action.vmsnapshot.create';
                            }
                        },
                        label: 'label.action.vmsnapshot.create',
                        addRow: 'false',
                        createForm: {
                            title: 'label.action.vmsnapshot.create',
                            fields: {
                                name: {
                                    label: 'label.name',
                                    isInput: true
                                },
                                description: {
                                    label: 'label.description',
                                    isTextarea: true
                                },
                                snapshotMemory: {
                                    label: 'label.vmsnapshot.memory',
                                    isBoolean: true,
                                    isChecked: false
                                }
                            }
                        },
                        action: function(args) {
                            var array1 = [];
                            array1.push("&snapshotmemory=" + (args.data.snapshotMemory == "on"));
                            var displayname = args.data.name;
                            if (displayname != null && displayname.length > 0) {
                                array1.push("&name=" + todb(displayname));
                            }
                            var description = args.data.description;
                            if (description != null && description.length > 0) {
                                array1.push("&description=" + todb(description));
                            }
                            $.ajax({
                                url: createURL("createVMSnapshot&virtualmachineid=" + args.context.instances[0].id + array1.join("")),
                                dataType: "json",
                                async: true,
                                success: function(json) {
                                    var jid = json.createvmsnapshotresponse.jobid;
                                    args.response.success({
                                        _custom: {
                                            jobId: jid,
                                            getUpdatedItem: function(json) {
                                                return json.queryasyncjobresultresponse.jobresult.virtualmachine;
                                            },
                                            getActionFilter: function() {
                                                return vmActionfilter;
                                            }
                                        }
                                    });
                                }
                            });

                        },
                        notification: {
                            pool: pollAsyncJobResult
                        }
                    },
                    destroy: {
                        label: 'label.action.destroy.instance',
                        compactLabel: 'label.destroy',
                        messages: {
                            confirm: function(args) {
                                return 'message.action.destroy.instance';
                            },
                            notification: function(args) {
                                return 'label.action.destroy.instance';
                            }
                        },
                        action: function(args) {
                            $.ajax({
                                url: createURL("destroyVirtualMachine&id=" + args.context.instances[0].id),
                                dataType: "json",
                                async: true,
                                success: function(json) {
                                    var jid = json.destroyvirtualmachineresponse.jobid;
                                    args.response.success({
                                        _custom: {
                                            jobId: jid,
                                            getUpdatedItem: function(json) {
                                                return json.queryasyncjobresultresponse.jobresult.virtualmachine;
                                            },
                                            getActionFilter: function() {
                                                return vmActionfilter;
                                            }
                                        }
                                    });
                                }
                            });
                        },
                        notification: {
                            poll: pollAsyncJobResult
                        }
                    },
                    restore: {
                        label: 'label.action.restore.instance',
                        compactLabel: 'label.restore',
                        messages: {
                            confirm: function(args) {
                                return 'message.action.restore.instance';
                            },
                            notification: function(args) {
                                return 'label.action.restore.instance';
                            }
                        },
                        action: function(args) {
                            $.ajax({
                                url: createURL("recoverVirtualMachine&id=" + args.context.instances[0].id),
                                dataType: "json",
                                async: true,
                                success: function(json) {
                                    var item = json.recovervirtualmachineresponse.virtualmachine;
                                    args.response.success({
                                        data: item
                                    });
                                }
                            });
                        },
                        notification: {
                            poll: function(args) {
                                args.complete({
                                    data: {
                                        state: 'Stopped'
                                    }
                                });
                            }
                        }
                    },
                    reset: {
                        label: 'Reset VM',
                        textLabel: 'Reset VM',
                        messages: {
                            confirm: function(args) {
                                return 'Do you want to restore the VM ?';
                            },
                            notification: function(args) {
                                return 'Reset VM';
                            },
                            complete: function(args) {
                            	if (args.password != null && args.password.length > 0)
                                    return 'Password has been reset to ' + args.password;
                            	else
                            		return null;
                            }
                        },

                        action: function(args) {
                            $.ajax({
                                url: createURL("restoreVirtualMachine&virtualmachineid=" + args.context.instances[0].id),
                                dataType: "json",
                                async: true,
                                success: function(json) {                                    
                                	var jid = json.restorevmresponse.jobid;                                    	
                                	args.response.success({
                                        _custom: {
                                            jobId: jid,
                                            getUpdatedItem: function(json) {                                         
                                                return json.queryasyncjobresultresponse.jobresult.virtualmachine;
                                            },
                                            getActionFilter: function() {
                                                return vmActionfilter;
                                            }
                                        }
                                    });                          	
                                }
                            });

                        },

                        notification: {
                            poll: pollAsyncJobResult
                        }

                    },

                    changeAffinity: {
                        label: 'Change affinity',

                        action: {
                            custom: cloudStack.uiCustom.affinity({
                                tierSelect: function(args) {
                                    if ('vpc' in args.context) { //from VPC section
                                        args.$tierSelect.show(); //show tier dropdown

                                        $.ajax({ //populate tier dropdown
                                            url: createURL("listNetworks"),
                                            async: false,
                                            data: {
                                                vpcid: args.context.vpc[0].id,
                                                //listAll: true,  //do not pass listAll to listNetworks under VPC
                                                domainid: args.context.vpc[0].domainid,
                                                account: args.context.vpc[0].account,
                                                supportedservices: 'StaticNat'
                                            },
                                            success: function(json) {
                                                var networks = json.listnetworksresponse.network;
                                                var items = [{
                                                    id: -1,
                                                    description: 'Please select a tier'
                                                }];
                                                $(networks).each(function() {
                                                    items.push({
                                                        id: this.id,
                                                        description: this.displaytext
                                                    });
                                                });
                                                args.response.success({
                                                    data: items
                                                });
                                            }
                                        });
                                    } else { //from Guest Network section
                                        args.$tierSelect.hide();
                                    }

                                    args.$tierSelect.change(function() {
                                        args.$tierSelect.closest('.list-view').listView('refresh');
                                    });
                                    args.$tierSelect.closest('.list-view').listView('refresh');
                                },

                                listView: {
                                    listView: {
                                        id: 'affinityGroups',
                                        fields: {
                                            name: {
                                                label: 'label.name'
                                            },
                                            type: {
                                                label: 'label.type'
                                            }
                                        },
                                        dataProvider: function(args) {
                                            var data = {
                                                domainid: args.context.instances[0].domainid,
                                                account: args.context.instances[0].account
                                            };
                                            $.ajax({
                                                url: createURL('listAffinityGroups'),
                                                data: data,
                                                async: false, //make it sync to avoid dataProvider() being called twice which produces duplicate data
                                                success: function(json) {
                                                    var items = [];
                                                    var allAffinityGroups = json.listaffinitygroupsresponse.affinitygroup;
                                                    var previouslySelectedAffinityGroups = args.context.instances[0].affinitygroup;
                                                    if (allAffinityGroups != null) {
                                                        for (var i = 0; i < allAffinityGroups.length; i++) {
                                                            var isPreviouslySelected = false;
                                                            if (previouslySelectedAffinityGroups != null) {
                                                                for (var k = 0; k < previouslySelectedAffinityGroups.length; k++) {
                                                                    if (previouslySelectedAffinityGroups[k].id == allAffinityGroups[i].id) {
                                                                        isPreviouslySelected = true;
                                                                        break; //break for loop
                                                                    }
                                                                }
                                                            }
                                                            items.push($.extend(allAffinityGroups[i], {
                                                                _isSelected: isPreviouslySelected
                                                            }));
                                                        }
                                                    }
                                                    args.response.success({
                                                        data: items
                                                    });
                                                }
                                            });
                                        }
                                    }
                                },
                                action: function(args) {
                                    var affinityGroupIdArray = [];
                                    if (args.context.affinityGroups != null) {
                                        for (var i = 0; i < args.context.affinityGroups.length; i++) {
                                            if (args.context.affinityGroups[i]._isSelected == true) {
                                                affinityGroupIdArray.push(args.context.affinityGroups[i].id);
                                            }
                                        }
                                    }
                                    var data = {
                                        id: args.context.instances[0].id,
                                        affinitygroupids: affinityGroupIdArray.join(",")
                                    };
                                    $.ajax({
                                        url: createURL('updateVMAffinityGroup'),
                                        data: data,
                                        success: function(json) {
                                            var jid = json.updatevirtualmachineresponse.jobid;
                                            args.response.success({
                                                _custom: {
                                                    jobId: jid,
                                                    getUpdatedItem: function(json) {
                                                        return json.queryasyncjobresultresponse.jobresult.virtualmachine;
                                                    },
                                                    getActionFilter: function() {
                                                        return vmActionfilter;
                                                    }
                                                }
                                            });
                                        }
                                    });
                                }
                            })
                        },
                        messages: {
                            notification: function(args) {
                                return 'Change affinity';
                            }
                        },
                        notification: {
                            poll: pollAsyncJobResult
                        }
                    },

                    edit: {
                        label: 'label.edit',
                        action: function(args) {
                            var data = {
                                id: args.context.instances[0].id,
                                group: args.data.group,
                                isdynamicallyscalable: (args.data.isdynamicallyscalable == "on"),
                                ostypeid: args.data.guestosid
                            };

                            if (args.data.displayname != args.context.instances[0].displayname) {
                                $.extend(data, {
                                    displayName: args.data.displayname
                                });
                            }

                            $.ajax({
                                url: createURL('updateVirtualMachine'),
                                data: data,
                                success: function(json) {
                                    var item = json.updatevirtualmachineresponse.virtualmachine;
                                    args.response.success({
                                        data: item
                                    });
                                }
                            });
                        }
                    },

                    attachISO: {
                        label: 'label.action.attach.iso',
                        createForm: {
                            title: 'label.action.attach.iso',
                            fields: {
                                iso: {
                                    label: 'ISO',
                                    select: function(args) {
                                        var items = [];
                                        var map = {};
                                        $.ajax({
                                            url: createURL("listIsos&isReady=true&isofilter=featured"),
                                            dataType: "json",
                                            async: false,
                                            success: function(json) {
                                                var isos = json.listisosresponse.iso;
                                                $(isos).each(function() {
                                                    items.push({
                                                        id: this.id,
                                                        description: this.displaytext
                                                    });
                                                    map[this.id] = 1;
                                                });
                                            }
                                        });
                                        $.ajax({
                                            url: createURL("listIsos&isReady=true&isofilter=community"),
                                            dataType: "json",
                                            async: false,
                                            success: function(json) {
                                                var isos = json.listisosresponse.iso;
                                                $(isos).each(function() {
                                                    if (!(this.id in map)) {
                                                        items.push({
                                                            id: this.id,
                                                            description: this.displaytext
                                                        });
                                                        map[this.id] = 1;
                                                    }
                                                });
                                            }
                                        });
                                        $.ajax({
                                            url: createURL("listIsos&isReady=true&isofilter=selfexecutable"),
                                            dataType: "json",
                                            async: false,
                                            success: function(json) {
                                                var isos = json.listisosresponse.iso;
                                                $(isos).each(function() {
                                                    if (!(this.id in map)) {
                                                        items.push({
                                                            id: this.id,
                                                            description: this.displaytext
                                                        });
                                                        map[this.id] = 1;
                                                    }
                                                });
                                            }
                                        });

                                        args.response.success({
                                            data: items
                                        });
                                    }
                                }
                            }
                        },
                        action: function(args) {
                            $.ajax({
                                url: createURL("attachIso&virtualmachineid=" + args.context.instances[0].id + "&id=" + args.data.iso),
                                dataType: "json",
                                async: true,
                                success: function(json) {
                                    var jid = json.attachisoresponse.jobid;
                                    args.response.success({
                                        _custom: {
                                            jobId: jid,
                                            getUpdatedItem: function(json) {
                                                return json.queryasyncjobresultresponse.jobresult.virtualmachine;
                                            },
                                            getActionFilter: function() {
                                                return vmActionfilter;
                                            }
                                        }
                                    });
                                }
                            });
                        },
                        messages: {
                            notification: function(args) {
                                return 'label.action.attach.iso';
                            }
                        },
                        notification: {
                            poll: pollAsyncJobResult
                        }
                    },

                    detachISO: {
                        label: 'label.action.detach.iso',
                        messages: {
                            confirm: function(args) {
                                return 'message.detach.iso.confirm';
                            },
                            notification: function(args) {
                                return 'label.action.detach.iso';
                            }
                        },
                        action: function(args) {
                            $.ajax({
                                url: createURL("detachIso&virtualmachineid=" + args.context.instances[0].id),
                                dataType: "json",
                                async: true,
                                success: function(json) {
                                    var jid = json.detachisoresponse.jobid;
                                    args.response.success({
                                        _custom: {
                                            jobId: jid,
                                            getUpdatedItem: function(json) {
                                                return json.queryasyncjobresultresponse.jobresult.virtualmachine;
                                            },
                                            getActionFilter: function() {
                                                return vmActionfilter;
                                            }
                                        }
                                    });
                                }
                            });
                        },
                        notification: {
                            poll: pollAsyncJobResult
                        }
                    },

                    resetPassword: {
                        label: 'label.action.reset.password',
                        messages: {
                            confirm: function(args) {
                                return 'message.action.instance.reset.password';
                            },
                            notification: function(args) {
                                return 'label.action.reset.password';
                            },
                            complete: function(args) {
                                return 'Password has been reset to ' + args.password;
                            }
                        },

                        preAction: function(args) {
                            var jsonObj = args.context.instances[0];
                            if (jsonObj.passwordenabled == false) {
                                cloudStack.dialog.notice({
                                    message: 'message.reset.password.warning.notPasswordEnabled'
                                });
                                return false;
                            } else if (jsonObj.state != 'Stopped') {
                                cloudStack.dialog.notice({
                                    message: 'message.reset.password.warning.notStopped'
                                });
                                return false;
                            }
                            return true;
                        },

                        action: function(args) {
                            $.ajax({
                                url: createURL("resetPasswordForVirtualMachine&id=" + args.context.instances[0].id),
                                dataType: "json",
                                async: true,
                                success: function(json) {
                                    var jid = json.resetpasswordforvirtualmachineresponse.jobid;
                                    args.response.success({
                                        _custom: {
                                            jobId: jid,
                                            getUpdatedItem: function(json) {
                                                return json.queryasyncjobresultresponse.jobresult.virtualmachine;
                                            },
                                            getActionFilter: function() {
                                                return vmActionfilter;
                                            }
                                        }
                                    });
                                }
                            });
                        },
                        notification: {
                            poll: pollAsyncJobResult
                        }
                    },

                    createTemplate: {
                        label: 'label.create.template',
                        messages: {
                            confirm: function(args) {
                                return 'message.create.template';
                            },
                            notification: function(args) {
                                return 'label.create.template';
                            }
                        },
                        createForm: {
                            title: 'label.create.template',
                            desc: 'label.create.template',
                            preFilter: cloudStack.preFilter.createTemplate,
                            fields: {
                                name: {
                                    label: 'label.name',
                                    validation: {
                                        required: true
                                    }
                                },
                                displayText: {
                                    label: 'label.description',
                                    validation: {
                                        required: true
                                    }
                                },
                                osTypeId: {
                                    label: 'label.os.type',
                                    select: function(args) {
                                        $.ajax({
                                            url: createURL("listOsTypes"),
                                            dataType: "json",
                                            async: true,
                                            success: function(json) {
                                                var ostypes = json.listostypesresponse.ostype;
                                                var items = [];
                                                $(ostypes).each(function() {
                                                    items.push({
                                                        id: this.id,
                                                        description: this.description
                                                    });
                                                });
                                                args.response.success({
                                                    data: items
                                                });
                                            }
                                        });
                                    }
                                },
                                isPublic: {
                                    label: 'label.public',
                                    isBoolean: true
                                },
                                url: {
                                    label: 'image.directory',
                                    validation: {
                                        required: true
                                    }
                                }
                            }
                        },
                        action: function(args) {
                            var data = {
                                virtualmachineid: args.context.instances[0].id,
                                name: args.data.name,
                                displayText: args.data.displayText,
                                osTypeId: args.data.osTypeId,
                                isPublic: (args.data.isPublic == "on"),
                                url: args.data.url
                            };

                            $.ajax({
                                url: createURL('createTemplate'),
                                data: data,
                                success: function(json) {
                                    var jid = json.createtemplateresponse.jobid;
                                    args.response.success({
                                        _custom: {
                                            jobId: jid,
                                            getUpdatedItem: function(json) {
                                                return {}; //no properties in this VM needs to be updated
                                            },
                                            getActionFilter: function() {
                                                return vmActionfilter;
                                            }
                                        }
                                    });
                                }
                            });
                        },
                        notification: {
                            poll: pollAsyncJobResult
                        }
                    },

                    migrate: {
                        label: 'label.migrate.instance.to.host',
                        compactLabel: 'label.migrate.to.host',
                        messages: {
                            confirm: function(args) {
                                return 'message.migrate.instance.to.host';
                            },
                            notification: function(args) {
                                return 'label.migrate.instance.to.host';
                            }
                        },
                        createForm: {
                            title: 'label.migrate.instance.to.host',
                            desc: '',
                            fields: {
                                hostId: {
                                    label: 'label.host',
                                    validation: {
                                        required: true
                                    },
                                    select: function(args) {
                                        $.ajax({
                                            url: createURL("findHostsForMigration&VirtualMachineId=" + args.context.instances[0].id),
                                            dataType: "json",
                                            async: true,
                                            success: function(json) {
                                                if (json.findhostsformigrationresponse.host != undefined) {
                                                    vmMigrationHostObjs = json.findhostsformigrationresponse.host;
                                                    var items = [];
                                                    $(vmMigrationHostObjs).each(function() {
                                                        if (this.requiresStorageMotion == true) {
                                                            items.push({
                                                                id: this.id,
                                                                description: (this.name + " (" + (this.suitableformigration ? "Suitable, " : "Not Suitable, ") + "Storage migration required)")
                                                            });

                                                        } else {
                                                            items.push({
                                                                id: this.id,
                                                                description: (this.name + " (" + (this.suitableformigration ? "Suitable" : "Not Suitable") + ")")
                                                            });
                                                        }
                                                    });
                                                    args.response.success({
                                                        data: items
                                                    });
                                                } else {
                                                    cloudStack.dialog.notice({
                                                        message: _l('No Hosts are avaialble for Migration')
                                                    }); //Only a single host in the set up
                                                }
                                            }
                                        });
                                    }
                                }
                            }
                        },
                        action: function(args) {
                            var selectedHostObj;
                            if (vmMigrationHostObjs != null) {
                                for (var i = 0; i < vmMigrationHostObjs.length; i++) {
                                    if (vmMigrationHostObjs[i].id == args.data.hostId) {
                                        selectedHostObj = vmMigrationHostObjs[i];
                                        break;
                                    }
                                }
                            }
                            if (selectedHostObj == null)
                                return;

                            if (selectedHostObj.requiresStorageMotion == true) {
                                $.ajax({
                                    url: createURL("migrateVirtualMachineWithVolume&hostid=" + args.data.hostId + "&virtualmachineid=" + args.context.instances[0].id),
                                    dataType: "json",
                                    async: true,
                                    success: function(json) {
                                        var jid = json.migratevirtualmachinewithvolumeresponse.jobid;
                                        args.response.success({
                                            _custom: {
                                                jobId: jid,
                                                getUpdatedItem: function(json) {
                                                    return json.queryasyncjobresultresponse.jobresult.virtualmachine;
                                                },
                                                getActionFilter: function() {
                                                    return vmActionfilter;
                                                }
                                            }
                                        });
                                    }
                                });
                            } else {
                                $.ajax({
                                    url: createURL("migrateVirtualMachine&hostid=" + args.data.hostId + "&virtualmachineid=" + args.context.instances[0].id),
                                    dataType: "json",
                                    async: true,
                                    success: function(json) {
                                        var jid = json.migratevirtualmachineresponse.jobid;
                                        args.response.success({
                                            _custom: {
                                                jobId: jid,
                                                getUpdatedItem: function(json) {
                                                    return json.queryasyncjobresultresponse.jobresult.virtualmachine;
                                                },
                                                getActionFilter: function() {
                                                    return vmActionfilter;
                                                }
                                            }
                                        });
                                    }
                                });
                            }
                        },
                        notification: {
                            poll: pollAsyncJobResult
                        }
                    },

                    migrateToAnotherStorage: {
                        label: 'label.migrate.instance.to.ps',
                        compactLabel: 'label.migrate.to.storage',
                        messages: {
                            confirm: function(args) {
                                return 'message.migrate.instance.to.ps';
                            },
                            notification: function(args) {
                                return 'label.migrate.instance.to.ps';
                            }
                        },
                        createForm: {
                            title: 'label.migrate.instance.to.ps',
                            desc: '',
                            fields: {
                                storageId: {
                                    label: 'label.primary.storage',
                                    validation: {
                                        required: true
                                    },
                                    select: function(args) {
                                        $.ajax({
                                            url: createURL("listStoragePools&zoneid=" + args.context.instances[0].zoneid),
                                            dataType: "json",
                                            async: true,
                                            success: function(json) {
                                                var pools = json.liststoragepoolsresponse.storagepool;
                                                var items = [];
                                                $(pools).each(function() {
                                                    items.push({
                                                        id: this.id,
                                                        description: this.name
                                                    });
                                                });
                                                args.response.success({
                                                    data: items
                                                });
                                            }
                                        });
                                    }
                                }
                            }
                        },
                        action: function(args) {
                            $.ajax({
                                url: createURL("migrateVirtualMachine&storageid=" + args.data.storageId + "&virtualmachineid=" + args.context.instances[0].id),
                                dataType: "json",
                                async: true,
                                success: function(json) {
                                    var jid = json.migratevirtualmachineresponse.jobid;
                                    args.response.success({
                                        _custom: {
                                            jobId: jid,
                                            getUpdatedItem: function(json) {
                                                return json.queryasyncjobresultresponse.jobresult.virtualmachine;
                                            },
                                            getActionFilter: function() {
                                                return vmActionfilter;
                                            }
                                        }
                                    });
                                }
                            });
                        },
                        notification: {
                            poll: pollAsyncJobResult
                        }
                    },

                    scaleUp: {
                        label: 'label.change.service.offering',
                        createForm: {
                            title: 'label.change.service.offering',
                            desc: function(args) {
                            	var description = '';                            	
                            	var vmObj = args.jsonObj;                            	
                            	if (vmObj.state == 'Running' && vmObj.hypervisor == 'VMware') {
                            		description = 'Please read the dynamic scaling section in the admin guide before scaling up.';
                            	}                             
                                return description;                  	                
                            },
                            fields: {
                                serviceOffering: {
                                    label: 'label.compute.offering',
                                    select: function(args) {
                                        $.ajax({
                                            url: createURL("listServiceOfferings&VirtualMachineId=" + args.context.instances[0].id),
                                            dataType: "json",
                                            async: true,
                                            success: function(json) {
                                                var serviceofferings = json.listserviceofferingsresponse.serviceoffering;
                                                var items = [];
                                                $(serviceofferings).each(function() {
                                                    items.push({
                                                        id: this.id,
                                                        description: this.name
                                                    });
                                                });
                                                args.response.success({
                                                    data: items
                                                });
                                            }
                                        });
                                    }
                                }
                            }
                        },

                        action: function(args) {
                            $.ajax({
                                url: createURL("scaleVirtualMachine&id=" + args.context.instances[0].id + "&serviceofferingid=" + args.data.serviceOffering),
                                dataType: "json",
                                async: true,
                                success: function(json) {
                                    var jid = json.scalevirtualmachineresponse.jobid;
                                    args.response.success({
                                        _custom: {
                                            jobId: jid,
                                            getUpdatedItem: function(json) {
                                                return json.queryasyncjobresultresponse.jobresult.virtualmachine;
                                            },
                                            getActionFilter: function() {
                                                return vmActionfilter;
                                            }
                                        }
                                    });

                                },
                                error: function(json) {
                                    args.response.error(parseXMLHttpResponse(json));
                                }

                            });
                        },
                        messages: {
                            confirm: function(args) {
                                return 'Do you really want to scale Up your instance ?';
                            },
                            notification: function(args) {
                                return 'Instance Scaled Up';
                            }
                        },
                        notification: {
                            poll: pollAsyncJobResult
                        }
                    },
                   
                    assignVmToAnotherAccount: {
                        label: 'Assign Instance to Another Account',
                        createForm: {
                            title: 'Assign Instance to Another Account',
                            fields: {                                
                            	domainid: {
                				    label: 'label.domain',
                				    validation: {
                                        required: true
                                    },
                				    select: function(args) {	
                				    	$.ajax({
            				                url: createURL('listDomains'),
            				                data: {
            				                    listAll: true,
            				                    details: 'min'
            				                },
            				                success: function(json) {
            				                    var array1 = [];
            				                    var domains = json.listdomainsresponse.domain;
            				                    if (domains != null && domains.length > 0) {
            				                        for (var i = 0; i < domains.length; i++) {
            				                            array1.push({
            				                                id: domains[i].id,
            				                                description: domains[i].path
            				                            });
            				                        }
            				                    }
            				                    args.response.success({
            				                        data: array1
            				                    });
            				                }
            				            });				                   				                 
                				    }
                				},
                				account: {
                				    label: 'label.account',
                				    validation: {
                                        required: true
                                    }
                				}		
                            }
                        },
                        action: function(args) {                            
                            $.ajax({
                                url: createURL('assignVirtualMachine&virtualmachine'),
                                data: {
                                    virtualmachineid: args.context.instances[0].id,
                                    domainid: args.data.domainid,
                                    account: args.data.account
                                },                                
                                success: function(json) {   
                                    var item = json.virtualmachine.virtualmachine;                                     
                                    args.response.success({
                                        data: item
                                    });                                    
                                }
                            });
                        },
                        messages: {
                            notification: function(args) {
                                return 'Assign Instance to Another Account';
                            }
                        },
                        notification: {
                            poll: function(args) {
                                args.complete();
                            }
                        }
                    },                    
                    
                    viewConsole: {
                        label: 'label.view.console',
                        action: {
                            externalLink: {
                                url: function(args) {
                                    return clientConsoleUrl + '?cmd=access&vm=' + args.context.instances[0].id;
                                },
                                title: function(args) {
                                    return args.context.instances[0].id.substr(0, 8); //title in window.open() can't have space nor longer than 8 characters. Otherwise, IE browser will have error.
                                },
                                width: 820,
                                height: 640
                            }
                        }
                    }
                },
                tabs: {
                    // Details tab
                    details: {
                        title: 'label.details',

                        preFilter: function(args) {
                            var hiddenFields;
                            if (isAdmin()) {
                                hiddenFields = [];
                            } else {
                                hiddenFields = ["hypervisor"];
                            }

                            if (!args.context.instances[0].publicip) {
                                hiddenFields.push('publicip');
                            }

                            if (!isAdmin()) {
                                hiddenFields.push('instancename');
                            }

                            return hiddenFields;
                        },

                        fields: [{
                            displayname: {
                                label: 'label.display.name',
                                isEditable: true
                            },
                            name: {
                                label: 'label.host.name'
                            },
                            state: {
                                label: 'label.state',
                                pollAgainIfValueIsIn: {
                                    'Starting': 1,
                                    'Stopping': 1
                                },
                                pollAgainFn: function(context) {
                                    var toClearInterval = false;
                                    $.ajax({
                                        url: createURL("listVirtualMachines&id=" + context.instances[0].id),
                                        dataType: "json",
                                        async: false,
                                        success: function(json) {
                                            var jsonObj = json.listvirtualmachinesresponse.virtualmachine[0];
                                            if (jsonObj.state != context.instances[0].state) {
                                                toClearInterval = true; //to clear interval
                                            }
                                        }
                                    });
                                    return toClearInterval;
                                }
                            },
                            templatename: {
                                label: 'label.template'
                            },

                            isdynamicallyscalable: {
                                label: 'Dynamically Scalable',
                                isBoolean: true,
                                isEditable: true,
                                converter: cloudStack.converters.toBooleanText
                            },

                            guestosid: {
                                label: 'label.os.type',
                                isEditable: true,
                                select: function(args) {
                                    $.ajax({
                                        url: createURL("listOsTypes"),
                                        dataType: "json",
                                        async: true,
                                        success: function(json) {
                                            var ostypes = json.listostypesresponse.ostype;
                                            var items = [];
                                            $(ostypes).each(function() {
                                                items.push({
                                                    id: this.id,
                                                    description: this.description
                                                });
                                            });
                                            args.response.success({
                                                data: items
                                            });
                                        }
                                    });
                                }
                            },

                            hypervisor: {
                                label: 'label.hypervisor'
                            },

                            /*
								isoid: {
                  label: 'label.attached.iso',
                  isEditable: false,
                  converter: function(isoid) {
                    return cloudStack.converters.toBooleanText(isoid != null);
                  }
                },
								*/
                            isoname: {
                                label: 'label.attached.iso'
                            },

                            serviceofferingname: {
                                label: 'label.compute.offering'
                            },
                            haenable: {
                                label: 'label.ha.enabled',
                                converter: cloudStack.converters.toBooleanText
                            },
                            publicip: {
                                label: 'label.public.ip'
                            },

                            group: {
                                label: 'label.group',
                                isEditable: true
                            },
                            zonename: {
                                label: 'label.zone.name',
                                isEditable: false
                            },
                            hostname: {
                                label: 'label.host'
                            },
                            publicip: {
                                label: 'label.public.ip'
                            },
                            domain: {
                                label: 'label.domain'
                            },
                            account: {
                                label: 'label.account'
                            },
                            created: {
                                label: 'label.created',
                                converter: cloudStack.converters.toLocalDate
                            },
                            name: {
                                label: 'label.name'
                            },
                            id: {
                                label: 'label.id'
                            }
                        }],

                        tags: cloudStack.api.tags({
                            resourceType: 'UserVm',
                            contextId: 'instances'
                        }),

                        dataProvider: function(args) {
                            $.ajax({
                                url: createURL("listVirtualMachines&id=" + args.context.instances[0].id),
                                dataType: "json",
                                async: true,
                                success: function(json) {
                                    var jsonObj;
                                    if (json.listvirtualmachinesresponse.virtualmachine != null && json.listvirtualmachinesresponse.virtualmachine.length > 0)
                                        jsonObj = json.listvirtualmachinesresponse.virtualmachine[0];
                                    else
                                        jsonObj = $.extend(args.context.instances[0], {
                                            state: "Destroyed"
                                        }); //after a regular user destroys a VM, listVirtualMachines API will no longer returns this destroyed VM to the regular user.

                                    args.response.success({
                                        actionFilter: vmActionfilter,
                                        data: jsonObj
                                    });
                                }
                            });
                        }
                    },

                    /**
                     * NICs tab
                     */
                    nics: {
                        title: 'label.nics',
                        multiple: true,
                        actions: {
                            add: {
                                label: 'Add network to VM',
                                messages: {
                                    confirm: function(args) {
                                        return 'Please confirm that you would like to add a new VM NIC for this network.';
                                    },
                                    notification: function(args) {
                                        return 'Add network to VM';
                                    }
                                },
                                createForm: {
                                    title: 'Add network to VM',
                                    desc: 'Please specify the network that you would like to add this VM to. A new NIC will be added for this network.',
                                    fields: {
                                        networkid: {
                                            label: 'label.network',
                                            select: function(args) {
                                                $.ajax({
                                                    url: createURL('listNetworks'),
                                                    data: {
                                                        listAll: true,
                                                        zoneid: args.context.instances[0].zoneid
                                                    },
                                                    success: function(json) {
                                                        args.response.success({
                                                            data: $.map(json.listnetworksresponse.network, function(network) {
                                                                return {
                                                                    id: network.id,
                                                                    description: network.name
                                                                };
                                                            })
                                                        });
                                                    }
                                                });
                                            }
                                        }
                                    }
                                },
                                action: function(args) {
                                    $.ajax({
                                        url: createURL('addNicToVirtualMachine'),
                                        data: {
                                            virtualmachineid: args.context.instances[0].id,
                                            networkid: args.data.networkid
                                        },
                                        success: function(json) {
                                            args.response.success({
                                                _custom: {
                                                    jobId: json.addnictovirtualmachineresponse.jobid
                                                }
                                            });
                                        }
                                    });
                                },
                                notification: {
                                    poll: pollAsyncJobResult
                                }
                            },

                            makeDefault: {
                                label: 'Set default NIC',
                                messages: {
                                    confirm: function() {
                                        return 'Please confirm that you would like to make this NIC the default for this VM.';
                                    },
                                    notification: function(args) {
                                        return 'Set default NIC'
                                    }
                                },
                                action: function(args) {
                                    $.ajax({
                                        url: createURL('updateDefaultNicForVirtualMachine'),
                                        data: {
                                            virtualmachineid: args.context.instances[0].id,
                                            nicid: args.context.nics[0].id
                                        },
                                        success: function(json) {
                                            args.response.success({
                                                _custom: {
                                                    jobId: json.updatedefaultnicforvirtualmachineresponse.jobid
                                                }
                                            });
                                            cloudStack.dialog.notice({
                                                message: _l('Please manually update the default NIC on the VM now.')
                                            });
                                        }
                                    });
                                },
                                notification: {
                                    poll: pollAsyncJobResult
                                }
                            },

                            // Remove NIC/Network from VM
                            remove: {
                                label: 'label.action.delete.nic',
                                messages: {
                                    confirm: function(args) {
                                        return 'message.action.delete.nic';
                                    },
                                    notification: function(args) {
                                        return 'label.action.delete.nic';
                                    }
                                },
                                action: function(args) {
                                    $.ajax({
                                        url: createURL('removeNicFromVirtualMachine'),
                                        data: {
                                            virtualmachineid: args.context.instances[0].id,
                                            nicid: args.context.nics[0].id
                                        },
                                        success: function(json) {
                                            args.response.success({
                                                _custom: {
                                                    jobId: json.removenicfromvirtualmachineresponse.jobid
                                                }
                                            })
                                        }
                                    });
                                },
                                notification: {
                                    poll: pollAsyncJobResult
                                }
                            }
                        },
                        fields: [{
                            id: {
                                label: 'ID'
                            },
                            name: {
                                label: 'label.name',
                                header: true
                            },
                            networkname: {
                                label: 'Network Name'
                            },
                            type: {
                                label: 'label.type'
                            },
                            ipaddress: {
                                label: 'label.ip.address'
                            },
                            gateway: {
                                label: 'label.gateway'
                            },
                            netmask: {
                                label: 'label.netmask'
                            },

                            ip6address: {
                                label: 'IPv6 IP Address'
                            },
                            ip6gateway: {
                                label: 'IPv6 Gateway'
                            },
                            ip6cidr: {
                                label: 'IPv6 CIDR'
                            },

                            isdefault: {
                                label: 'label.is.default',
                                converter: function(data) {
                                    return data ? _l('label.yes') : _l('label.no');
                                }
                            }
                        }],
                        viewAll: {
                            path: 'network.secondaryNicIps',
                            attachTo: 'ipaddress',
                            label: 'label.view.secondary.ips',
                            title: function(args) {
                                var title = _l('label.menu.ipaddresses') + ' - ' + args.context.nics[0].name;

                                return title;
                            }
                        },
                        dataProvider: function(args) {
                            $.ajax({
                                url: createURL("listVirtualMachines&details=nics&id=" + args.context.instances[0].id),
                                dataType: "json",
                                async: true,
                                success: function(json) {
                                    // Handling the display of network name for a VM under the NICS tabs
                                    args.response.success({
                                        actionFilter: function(args) {
                                            if (args.context.item.isdefault) {
                                                return [];
                                            } else {
                                                return ['remove', 'makeDefault'];
                                            }
                                        },
                                        data: $.map(json.listvirtualmachinesresponse.virtualmachine[0].nic, function(nic, index) {
                                            var name = 'NIC ' + (index + 1);
                                            if (nic.isdefault) {
                                                name += ' (' + _l('label.default') + ')';
                                            }
                                            return $.extend(nic, {
                                                name: name
                                            });
                                        })
                                    });
                                }
                            });
                        }
                    },

                    /**
                     * Security Groups tab
                     */
                    securityGroups: {
                        title: 'label.menu.security.groups',
                        multiple: true,
                        fields: [{
                            id: {
                                label: 'ID'
                            },
                            name: {
                                label: 'label.name'
                            },
                            description: {
                                label: 'label.description'
                            }
                        }],
                        dataProvider: function(args) {
                            // args.response.success({data: args.context.instances[0].securitygroup});
                            $.ajax({
                                url: createURL("listVirtualMachines&details=secgrp&id=" + args.context.instances[0].id),
                                dataType: "json",
                                async: true,
                                success: function(json) {
                                    args.response.success({
                                        data: json.listvirtualmachinesresponse.virtualmachine[0].securitygroup
                                    });
                                }

                            });
                        }
                    },

                    /**
                     * Statistics tab
                     */
                    stats: {
                        title: 'label.statistics',
                        fields: {
                            totalCPU: {
                                label: 'label.total.cpu'
                            },
                            cpuused: {
                                label: 'label.cpu.utilized'
                            },
                            networkkbsread: {
                                label: 'label.network.read'
                            },
                            networkkbswrite: {
                                label: 'label.network.write'
                            },
                            diskkbsread: {
                                label: 'label.disk.read.bytes'
                            },
                            diskkbswrite: {
                                label: 'label.disk.write.bytes'
                            },
                            diskioread: {
                                label: 'label.disk.read.io'
                            },
                            diskiowrite: {
                                label: 'label.disk.write.io'
                            }
                        },
                        dataProvider: function(args) {
                            $.ajax({
                                url: createURL("listVirtualMachines&details=stats&id=" + args.context.instances[0].id),
                                dataType: "json",
                                async: true,
                                success: function(json) {
                                    var jsonObj = json.listvirtualmachinesresponse.virtualmachine[0];
                                    args.response.success({
                                        data: {
                                            totalCPU: jsonObj.cpunumber + " x " + cloudStack.converters.convertHz(jsonObj.cpuspeed),
                                            cpuused: jsonObj.cpuused,
                                            networkkbsread: (jsonObj.networkkbsread == null) ? "N/A" : cloudStack.converters.convertBytes(jsonObj.networkkbsread * 1024),
                                            networkkbswrite: (jsonObj.networkkbswrite == null) ? "N/A" : cloudStack.converters.convertBytes(jsonObj.networkkbswrite * 1024),
                                            diskkbsread: (jsonObj.diskkbsread == null) ? "N/A" : ((jsonObj.hypervisor == "KVM") ? cloudStack.converters.convertBytes(jsonObj.diskkbsread * 1024) : ((jsonObj.hypervisor == "XenServer") ? cloudStack.converters.convertBytes(jsonObj.diskkbsread * 1024) + "/s" : "N/A")),
                                            diskkbswrite: (jsonObj.diskkbswrite == null) ? "N/A" : ((jsonObj.hypervisor == "KVM") ? cloudStack.converters.convertBytes(jsonObj.diskkbswrite * 1024) : ((jsonObj.hypervisor == "XenServer") ? cloudStack.converters.convertBytes(jsonObj.diskkbswrite * 1024) + "/s" : "N/A")),
                                            diskioread: (jsonObj.diskioread == null) ? "N/A" : ((jsonObj.hypervisor == "KVM") ? jsonObj.diskioread : "N/A"),
                                            diskiowrite: (jsonObj.diskiowrite == null) ? "N/A" : ((jsonObj.hypervisor == "KVM") ? jsonObj.diskiowrite : "N/A")
                                        }
                                    });
                                }
                            });
                        }
                    }
                }
            }
        }
    };

    var vmActionfilter = cloudStack.actionFilter.vmActionFilter = function(args) {
        var jsonObj = args.context.item;
        var allowedActions = [];

        if (jsonObj.state == 'Destroyed') {
            if (isAdmin() || isDomainAdmin()) {
                allowedActions.push("restore");
            }
        } else if (jsonObj.state == 'Running') {
            allowedActions.push("stop");
            allowedActions.push("restart");
            allowedActions.push("snapshot");
            allowedActions.push("destroy");            
            allowedActions.push("reset");
             
            //when userVm is running, scaleUp is not supported for KVM
            if (jsonObj.hypervisor != 'KVM') {
            	allowedActions.push("scaleUp");
            }              

            if (isAdmin())
                allowedActions.push("migrate");

            if (jsonObj.isoid == null)
                allowedActions.push("attachISO");
            else
                allowedActions.push("detachISO");

            allowedActions.push("resetPassword");

            if (jsonObj.hypervisor == "BareMetal") {
                allowedActions.push("createTemplate");
            }

            allowedActions.push("viewConsole");
        } else if (jsonObj.state == 'Stopped') {
            allowedActions.push("edit");
            allowedActions.push("start");
            allowedActions.push("destroy");
            allowedActions.push("reset");
            allowedActions.push("snapshot");
            allowedActions.push("scaleUp");  //when vm is stopped, scaleUp is supported for all hypervisors 
            allowedActions.push("changeAffinity");

            if (isAdmin())
                allowedActions.push("migrateToAnotherStorage");

            if (jsonObj.isoid == null) {
                allowedActions.push("attachISO");
            } else {
                allowedActions.push("detachISO");
            }
            allowedActions.push("resetPassword");            
            if (jsonObj.hypervisor == "BareMetal") {
                allowedActions.push("createTemplate");
            }
            
            if (isAdmin() || isDomainAdmin()) {
                allowedActions.push("assignVmToAnotherAccount");
            }
            
        } else if (jsonObj.state == 'Starting') {
            //  allowedActions.push("stop");
        } else if (jsonObj.state == 'Error') {
            allowedActions.push("destroy");
        }
        return allowedActions;
    }

})(jQuery, cloudStack);
