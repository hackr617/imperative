/*
* This program and the accompanying materials are made available under the terms of the *
* Eclipse Public License v2.0 which accompanies this distribution, and is available at *
* https://www.eclipse.org/legal/epl-v20.html                                      *
*                                                                                 *
* SPDX-License-Identifier: EPL-2.0                                                *
*                                                                                 *
* Copyright Contributors to the Zowe Project.                                     *
*                                                                                 *
*/

import Mock = jest.Mock;

jest.mock("fs");
jest.mock("jsonfile");
jest.mock("../../src/plugins/utilities/PMFConstants");

import { existsSync, mkdirSync } from "fs";
import { ICommandDefinition } from "../../../../packages/cmd";
import { IImperativeConfig } from "../../src/doc/IImperativeConfig";
import { ImperativeConfig } from "../../src/ImperativeConfig";
import { IPluginJson } from "../../src/plugins/doc/IPluginJson";
import { IssueSeverity, PluginIssues } from "../../src/plugins/utilities/PluginIssues";
import { join, resolve } from "path";
import { PluginManagementFacility } from "../../src/plugins/PluginManagementFacility";
import { PMFConstants } from "../../src/plugins/utilities/PMFConstants";
import { readFileSync, writeFileSync } from "jsonfile";
import { ConfigurationLoader } from "../../src/ConfigurationLoader";
import { ConfigurationValidator } from "../../src/ConfigurationValidator";
import { ICommandProfileTypeConfiguration } from "../../../cmd";
import { DefinitionTreeResolver } from "../../src/DefinitionTreeResolver";
import { ImperativeError } from "../../../error";
import {IPluginCfgProps} from "../../src/plugins/doc/IPluginCfgProps";

describe("Plugin Management Facility", () => {
    const mocks = {
        existsSync: existsSync as Mock<typeof existsSync>,
        mkdirSync: mkdirSync as Mock<typeof mkdirSync>,
        writeFileSync: writeFileSync as Mock<typeof writeFileSync>,
        readFileSync: readFileSync as Mock<typeof readFileSync>
    };

    /* Put a base CLI config into ImperativeConfig. It is required by infrastructure
     * that is called underneath the functions that we want to test.
     */
    const impCfg: ImperativeConfig = ImperativeConfig.instance;
    impCfg.loadedConfig = require("./baseCliConfig.testData");
    impCfg.callerLocation = resolve("../../../../imperative-sample/lib/index.js");

    const mockAddCmdGrpToResolvedCliCmdTree = jest.fn();
    let realAddCmdGrpToResolvedCliCmdTree: any;

    const mockCfgValidator = jest.fn();
    let realCfgValidator: any;

    const pluginName = "sample-plugin";
    const PMF = PluginManagementFacility.instance as any;
    const pluginIssues = PluginIssues.instance;
    let isValid: boolean;
    let goodPluginConfig: IImperativeConfig;
    let goodPluginCmdDef: ICommandDefinition;
    let goodBaseCliPkgJson: any;
    const goodPluginSummary: string = "This is my plugin summary!";
    const goodPluginAliases: string[] = ["sp", "samp"];
    beforeEach(() => {
        jest.resetAllMocks();
        realAddCmdGrpToResolvedCliCmdTree = PMF.addCmdGrpToResolvedCliCmdTree;
        PMF.addCmdGrpToResolvedCliCmdTree = mockAddCmdGrpToResolvedCliCmdTree;

        realCfgValidator = ConfigurationValidator.validate;
        ConfigurationValidator.validate = mockCfgValidator;
        pluginIssues.removeIssuesForPlugin(pluginName);

        goodBaseCliPkgJson = {
            name: "imperative-sample",
            version: "1.0.0",
            description: "Sample Imperative CLI",
            license: "EPL 2.0",
            repository: "",
            bin: {
                "sample-cli": "./lib/index.js"
            }
        };

        goodPluginConfig = {
            name: "sample-plugin",
            pluginAliases: goodPluginAliases,
            pluginSummary: goodPluginSummary,
            rootCommandDescription: "imperative sample plugin",
            pluginBaseCliVersion: "^1.0.0",
            pluginHealthCheck: "./lib/sample-plugin/healthCheck.handler",
            definitions: [
                {
                    name: "foo",
                    description: "dummy foo command",
                    type: "command",
                    handler: "./lib/sample-plugin/cmd/foo/foo.handler"
                },
                {
                    name: "bar",
                    description: "dummy bar command",
                    type: "command",
                    handler: "./lib/sample-plugin/cmd/bar/bar.handler"
                }
            ],
            profiles: [
                {
                    type: "TestProfile",
                    schema: {
                        type: "object",
                        title: "The test profile schema",
                        description: "The test command profile description",
                        properties: {
                            size: {
                                optionDefinition: {
                                    description: "Some description of size",
                                    type: "string",
                                    name: "size", aliases: ["s"],
                                    required: true
                                },
                                type: "string",
                            }
                        }
                    }
                }
            ]
        };

        goodPluginCmdDef = {
            name: goodPluginConfig.name,
            aliases: goodPluginAliases,
            summary: goodPluginSummary,
            description: goodPluginConfig.rootCommandDescription,
            type: "group",
            children: goodPluginConfig.definitions
        };
    });

    afterEach(() => {
        PMF.addCmdGrpToResolvedCliCmdTree = realAddCmdGrpToResolvedCliCmdTree;
        ConfigurationValidator.validate = realCfgValidator;
    });

    it("should initialize properly", () => {
        mocks.existsSync.mockReturnValue(true);
        expect(PluginManagementFacility.instance).toBeTruthy();
    });

    it("should add our plugin command definitions", () => {
        const mockAddCmdGrpToLoadedConfig = jest.fn();
        const realAddCmdGrpToLoadedConfig = impCfg.addCmdGrpToLoadedConfig;
        impCfg.addCmdGrpToLoadedConfig = mockAddCmdGrpToLoadedConfig;
        const mockFindPackageBinName = jest.fn(() => "MockCliCmdName");
        const realFindPackageBinName = impCfg.findPackageBinName;
        impCfg.findPackageBinName = mockFindPackageBinName;

        const installDef: ICommandDefinition = require("../../src/plugins/cmd/install/install.definition").installDefinition;
        const listDef: ICommandDefinition = require("../../src/plugins/cmd/list/list.definition").listDefinition;
        const uninstallDef: ICommandDefinition = require("../../src/plugins/cmd/uninstall/uninstall.definition").uninstallDefinition;
        const updateDef: ICommandDefinition = require("../../src/plugins/cmd/update/update.definition").updateDefinition;
        const validateDef: ICommandDefinition = require("../../src/plugins/cmd/validate/validate.definition").validateDefinition;
        mocks.existsSync.mockReturnValue(true);

        expect((PluginManagementFacility.instance as any).wasInitCalled).toBe(false);
        PluginManagementFacility.instance.init();
        expect((PluginManagementFacility.instance as any).wasInitCalled).toBe(true);

        expect(impCfg.addCmdGrpToLoadedConfig).toHaveBeenCalledWith({
            name: "plugins",
            type: "group",
            description: "Install and manage plug-ins",
            children: [
                installDef,
                listDef,
                uninstallDef,
                updateDef,
                validateDef
            ]
        });
        impCfg.addCmdGrpToLoadedConfig = realAddCmdGrpToLoadedConfig;
        impCfg.findPackageBinName = realFindPackageBinName;
    });

    describe("loadAllPluginCfgProps function", () => {
        const mockInstalledPlugins: IPluginJson = {
            firstPlugin: {package: "1", registry: "1", version: "1"},
            secondPlugin: {package: "2", registry: "2", version: "2"}
        };
        const loadPluginCfgPropsReal: any = PMF.loadPluginCfgProps;
        const loadPluginCfgPropsMock = jest.fn();

        beforeAll(() => {
            // loadPluginCfgProps is a sub-function that we do not want to run
            PMF.loadPluginCfgProps = loadPluginCfgPropsMock;
        });

        afterAll(() => {
            PMF.loadPluginCfgProps = loadPluginCfgPropsReal;
        });

        beforeEach(() => {
            // supply data for PluginIssues.getInstalledPlugins()
            mocks.readFileSync.mockReturnValue(mockInstalledPlugins);
        });

        it("should create the plugins.json file and directory", () => {
            mocks.existsSync
                .mockReturnValueOnce(false)   // directory does not exist
                .mockReturnValueOnce(false);  // plugins.json does not exist

            PluginManagementFacility.instance.loadAllPluginCfgProps();

            // confirm it created the plugins directory
            expect(mocks.mkdirSync).toHaveBeenCalledWith(PMFConstants.instance.PMF_ROOT);

            // confirm it wrote plugins.json
            // Can't check toHaveBeenCalledWith because of magic typescript voodoo. Apparently the compiled
            // JavaScript has extra parameters.
            expect(mocks.writeFileSync).toHaveBeenCalledTimes(1);
            expect(mocks.writeFileSync.mock.calls[0][0]).toBe(PMFConstants.instance.PLUGIN_JSON);
        });

        it("should create the plugins.json file but not the directory", () => {
            mocks.existsSync
                .mockReturnValueOnce(false) // directory does not exist
                .mockReturnValueOnce(true); // file does exist

            PluginManagementFacility.instance.loadAllPluginCfgProps();

            // confirm that we created the directory and wrote the file
            expect(mocks.mkdirSync).not.toHaveBeenCalled();
            expect(mocks.writeFileSync).toHaveBeenCalledTimes(1);
        });

        it("should not create the file", () => {
            mocks.existsSync.mockReturnValue(true);  // both directory and file exists
            PluginManagementFacility.instance.loadAllPluginCfgProps();

            // confirm that we did not write plugins.json
            expect(mocks.writeFileSync).not.toHaveBeenCalled();
        });

        it("should not crash when loadPluginCfgProps returns null", () => {
            mocks.existsSync.mockReturnValue(true);  // both directory and file exists
            loadPluginCfgPropsMock.mockReturnValue(null);

            PluginManagementFacility.instance.loadAllPluginCfgProps();
        });

        it("should not crash when loadPluginCfgProps has no overrides", () => {
            const pluginCfgProps: IPluginCfgProps = {
                pluginName,
                npmPackageName: "PluginHasNoNpmPkgName",
                impConfig: {},
                cliDependency: {
                    peerDepName: "@brightside/core",
                    peerDepVer: "-1"
                },
                impDependency: {
                    peerDepName: "@brightside/imperative",
                    peerDepVer: "-1"
                }
            };

            mocks.existsSync.mockReturnValue(true);  // both directory and file exists
            loadPluginCfgPropsMock.mockReturnValue(pluginCfgProps);

            PluginManagementFacility.instance.loadAllPluginCfgProps();
        });

        it("should store the CredentialManager override", () => {
            const credMgrOverride = {
                CredentialManager: "CredentialManagerOverrideString"
            };
            const pluginCfgProps: IPluginCfgProps = {
                pluginName,
                npmPackageName: "PluginHasNoNpmPkgName",
                impConfig: {
                    overrides: credMgrOverride
                },
                cliDependency: {
                    peerDepName: "@brightside/core",
                    peerDepVer: "-1"
                },
                impDependency: {
                    peerDepName: "@brightside/imperative",
                    peerDepVer: "-1"
                }
            };

            mocks.existsSync.mockReturnValue(true);  // both directory and file exists
            loadPluginCfgPropsMock.mockReturnValue(pluginCfgProps);

            PluginManagementFacility.instance.loadAllPluginCfgProps();
            expect(PMF.pluginOverrides).toEqual(credMgrOverride);
        });
    }); // end loadAllPluginCfgProps

    describe("Plugin validation", () => {
        let badPluginConfig: IImperativeConfig = null;
        const mockValidatePluginCmdDefs = jest.fn();
        const realValidatePluginCmdDefs = PMF.validatePluginCmdDefs;
        const mockAreVersionsCompatible = jest.fn();
        const realAreVersionsCompatible = PMF.areVersionsCompatible;
        const mockConflictNmOrAlias = jest.fn(() => {
            return {hasConflict: false};
        });
        const realConflictName = PMF.conflictingNameOrAlias;
        const mockValidateImperativeVersions = jest.fn();
        const realValidateImperativeVersions = PMF.validateImperativeVersions;

        beforeEach(() => {
            PMF.areVersionsCompatible = mockAreVersionsCompatible;
            PMF.validatePluginCmdDefs = mockValidatePluginCmdDefs;
            PMF.conflictingNameOrAlias = mockConflictNmOrAlias;
            PMF.validateImperativeVersions = mockValidateImperativeVersions;

            // set a workable resolved CLI command tree
            PMF.resolvedCliCmdTree = {
                children: [
                    {
                        name: "cmdFromCli",
                        description: "dummy command",
                        type: "command",
                        handler: "./lib/sample-plugin/cmd/foo/foo.handler"
                    }
                ]
            };

            // getCallerPackageJson is a getter of a property, so mock the property
            Object.defineProperty(impCfg, "callerPackageJson", {
                configurable: true,
                get: jest.fn(() => {
                    return goodBaseCliPkgJson;
                })
            });
        });

        afterEach(() => {
            PMF.areVersionsCompatible = realAreVersionsCompatible;
            PMF.validatePluginCmdDefs = realValidatePluginCmdDefs;
            PMF.conflictingNameOrAlias = realConflictName;
            PMF.validateImperativeVersions = realValidateImperativeVersions;
        });

        describe("validatePlugin function", () => {

            it("should return false if no plugin config is supplied and cannot be read", () => {
                const realReadPluginConfig = PMF.readPluginConfig;
                const mockReadPluginConfig = jest.fn();
                PMF.readPluginConfig = mockReadPluginConfig;
                mockReadPluginConfig.mockReturnValue(null);

                isValid = PMF.validatePlugin(pluginName);

                expect(isValid).toBe(false);
                PMF.readPluginConfig = realReadPluginConfig;
            });

            it("should record an error when both plugin group name property and npm name do not exist", () => {
                // remove name property from config
                badPluginConfig = JSON.parse(JSON.stringify(goodPluginConfig));
                delete badPluginConfig.name;

                // remove the npm name property
                PMF.npmPkgName = null;

                isValid = PMF.validatePlugin(pluginName, badPluginConfig, goodPluginCmdDef);
                expect(isValid).toBe(false);

                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain(
                    "The plugin's configuration does not contain an 'imperative.name' property, or an npm package 'name' property in package.json.");
            });

            it("should use npm package name when plugin's name property does not exist", () => {
                PMF.conflictingNameOrAlias = realConflictName;
                // remove name property from config
                badPluginConfig = JSON.parse(JSON.stringify(goodPluginConfig));
                delete badPluginConfig.name;
                PMF.npmPkgName = "NpmPackageName";

                // Ensure we get to the function that we want to validate
                mocks.existsSync.mockReturnValue(true);
                PMF.areVersionsCompatible = realAreVersionsCompatible;

                isValid = PMF.validatePlugin(pluginName, badPluginConfig, goodPluginCmdDef);

                expect(isValid).toBe(true);
                expect(pluginIssues.getIssueListForPlugin(pluginName).length).toBe(0);
                expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(false);
                PMF.npmPkgName = null;
            });

            it("should record error when there is a name conflict", () => {
                PMF.conflictingNameOrAlias.mockReturnValue({
                    hasConflict: true, message: "The plug-in attempted to add a command group named 'sample-plugin'. " +
                    "Your base application already contains a command group named 'sample-plugin'."
                });

                isValid = PMF.validatePlugin(pluginName, goodPluginConfig, goodPluginCmdDef);
                expect(isValid).toBe(false);
                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueText).toContain(
                    "The plug-in attempted to add a command group named 'sample-plugin'. " +
                    "Your base application already contains a command group named 'sample-plugin'."
                );
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
            });

            it("should record error when rootCommandDescription does not exist", () => {
                // remove rootCommandDescription property from config
                badPluginConfig = JSON.parse(JSON.stringify(goodPluginConfig));
                delete badPluginConfig.rootCommandDescription;

                // Ensure we get to the function that we want to validate
                PMF.conflictingNameOrAlias.mockReturnValue({hasConflict: false});

                isValid = PMF.validatePlugin(pluginName, badPluginConfig, goodPluginCmdDef);
                expect(isValid).toBe(false);
                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain(
                    "The plugin's configuration does not contain an 'imperative.rootCommandDescription' property.");
            });

            it("should record error when plugin's children property does not exist", () => {
                // remove children property from the plugin command definitions
                const badPluginCmdDef = JSON.parse(JSON.stringify(goodPluginCmdDef));
                delete badPluginCmdDef.children;

                // Ensure we get to the function that we want to validate
                PMF.conflictingNameOrAlias.mockReturnValue({hasConflict: false});
                mockAreVersionsCompatible.mockReturnValueOnce(true);
                mocks.existsSync.mockReturnValue(true);

                isValid = PMF.validatePlugin(pluginName, goodPluginConfig, badPluginCmdDef);
                expect(isValid).toBe(false);
                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain(
                    "The plugin's configuration defines no children.");
            });

            it("should record error when plugin's children property is empty", () => {
                // create and empty children property in the plugin command definitions
                const badPluginCmdDef = JSON.parse(JSON.stringify(goodPluginCmdDef));
                badPluginCmdDef.children = [];

                // Ensure we get to the function that we want to validate
                PMF.conflictingNameOrAlias.mockReturnValue({hasConflict: false});
                mockAreVersionsCompatible.mockReturnValueOnce(true);
                mocks.existsSync.mockReturnValue(true);

                isValid = PMF.validatePlugin(pluginName, goodPluginConfig, badPluginCmdDef);
                expect(isValid).toBe(false);
                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain(
                    "The plugin's configuration defines no children.");
            });

            it("should record warning if plugin healthCheck property does not exist", () => {
                // remove pluginHealthCheck property from config
                badPluginConfig = JSON.parse(JSON.stringify(goodPluginConfig));
                delete badPluginConfig.pluginHealthCheck;

                // Ensure we get to the function that we want to validate
                mockConflictNmOrAlias.mockReturnValueOnce(false);
                mockAreVersionsCompatible.mockReturnValueOnce(true);

                isValid = PMF.validatePlugin(pluginName, badPluginConfig, goodPluginCmdDef);

                // missing healthCheck is just a warning, so we succeed
                expect(isValid).toBe(true);

                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.WARNING);
                expect(issue.issueText).toContain(
                    "The plugin's configuration does not contain an 'imperative.pluginHealthCheck' property.");
            });

            it("should record error if plugin healthCheck file does not exist", () => {
                // set pluginHealthCheck property to a bogus file
                badPluginConfig = JSON.parse(JSON.stringify(goodPluginConfig));
                badPluginConfig.pluginHealthCheck = "./This/File/Does/Not/Exist";

                // Ensure we get to the function that we want to validate
                mockConflictNmOrAlias.mockReturnValueOnce(false);
                mockAreVersionsCompatible.mockReturnValueOnce(true);

                isValid = PMF.validatePlugin(pluginName, badPluginConfig, goodPluginCmdDef);
                expect(isValid).toBe(false);

                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain(
                    "The program for the 'imperative.pluginHealthCheck' property does not exist: " +
                    join(PMFConstants.instance.PLUGIN_NODE_MODULE_LOCATION, pluginName, "This/File/Does/Not/Exist.js"));
            });

            it("should record error when ConfigurationValidator throws an exception", () => {
                PMF.conflictingNameOrAlias = realConflictName;
                // Ensure we get to the function that we want to validate
                mocks.existsSync.mockReturnValue(true);
                PMF.areVersionsCompatible = realAreVersionsCompatible;

                mockCfgValidator.mockImplementationOnce(() => {
                    throw new Error("Mock validation error");
                });

                // this is what we really want to test
                isValid = PMF.validatePlugin(pluginName, goodPluginConfig, goodPluginCmdDef);
                expect(isValid).toBe(false);

                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain(
                    "The plugin configuration is invalid.\nReason = Mock validation error");
            });

            it("should have no errors or warnings, when everything is correct", () => {
                PMF.conflictingNameOrAlias = realConflictName;
                // Ensure we get to the function that we want to validate
                mocks.existsSync.mockReturnValue(true);
                PMF.areVersionsCompatible = realAreVersionsCompatible;

                isValid = PMF.validatePlugin(pluginName, goodPluginConfig, goodPluginCmdDef);

                expect(isValid).toBe(true);
                expect(pluginIssues.getIssueListForPlugin(pluginName).length).toBe(0);
                expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(false);
            });
        });

        describe("Validate a plugin's command tree", () => {

            beforeEach(() => {
                // for this set of tests, run the real validatePluginCmdDefs
                PMF.validatePluginCmdDefs = realValidatePluginCmdDefs;
            });

            it("should have no issues when the plugin command defs are valid", () => {
                // Ensure we get to the function that we want to validate
                mocks.existsSync.mockReturnValue(true);

                PMF.validatePluginCmdDefs(pluginName, [goodPluginCmdDef], 1);
                expect(pluginIssues.getIssueListForPlugin(pluginName).length).toBe(0);
                expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(false);
            });

            it("should record an error when plugin has no children property", () => {
                // remove name property from a command definition
                const badPluginCmdDef: ICommandDefinition = JSON.parse(JSON.stringify(goodPluginCmdDef));
                delete badPluginCmdDef.children;

                // Ensure we get to the function that we want to validate
                mocks.existsSync.mockReturnValue(true);

                PMF.validatePluginCmdDefs(pluginName, [badPluginCmdDef], 1);

                expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(true);
                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain("has no 'children' property");
            });

            it("should record an error when the children property is empty", () => {
                // remove name property from a command definition
                const badPluginCmdDef: ICommandDefinition = JSON.parse(JSON.stringify(goodPluginCmdDef));
                badPluginCmdDef.children = [];

                // Ensure we get to the function that we want to validate
                mocks.existsSync.mockReturnValue(true);

                PMF.validatePluginCmdDefs(pluginName, [badPluginCmdDef], 1);

                expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(true);
                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain("has a 'children' property with no children");
            });

            it("should record an error when a plugin command has no name", () => {
                // remove name property from a command definition
                const badPluginCmdDef: ICommandDefinition = JSON.parse(JSON.stringify(goodPluginCmdDef));
                delete badPluginCmdDef.children[0].name;

                // Ensure we get to the function that we want to validate
                mocks.existsSync.mockReturnValue(true);

                PMF.validatePluginCmdDefs(pluginName, [badPluginCmdDef], 1);

                expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(true);
                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain(
                    "Command definition at depth 2 has no 'name' property");
            });

            it("should record an error when a plugin command has no type", () => {
                // remove type property from a command definition
                const badPluginCmdDef: ICommandDefinition = JSON.parse(JSON.stringify(goodPluginCmdDef));
                delete badPluginCmdDef.children[0].type;

                // Ensure we get to the function that we want to validate
                mocks.existsSync.mockReturnValue(true);

                PMF.validatePluginCmdDefs(pluginName, [badPluginCmdDef], 1);

                expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(true);
                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain(
                    "Name = 'foo (at depth = 2)' has no 'type' property");
            });

            it("should record an error when a plugin command has no handler", () => {
                // remove handler property from a command definition
                const badPluginCmdDef: ICommandDefinition = JSON.parse(JSON.stringify(goodPluginCmdDef));
                delete badPluginCmdDef.children[0].handler;

                // Ensure we get to the function that we want to validate
                mocks.existsSync.mockReturnValue(true);

                PMF.validatePluginCmdDefs(pluginName, [badPluginCmdDef], 1);

                expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(true);
                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain(
                    "Command name = 'foo (at depth = 2)' has no 'handler' property");
            });

            it("should record an error when a plugin command handler file does not exist", () => {
                // set a handler property to a bad path
                const badPluginCmdDef: ICommandDefinition = JSON.parse(JSON.stringify(goodPluginCmdDef));
                badPluginCmdDef.children[0].handler = "./This/File/Does/Not/Exist";

                // Ensure we get to the function that we want to test
                mocks.existsSync.mockReturnValueOnce(false);

                PMF.validatePluginCmdDefs(pluginName, [badPluginCmdDef], 1);

                expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(true);
                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain(
                    "The handler for command = 'foo (at depth = 2)' does not exist: " +
                    join(PMFConstants.instance.PLUGIN_NODE_MODULE_LOCATION, "sample-plugin/This/File/Does/Not/Exist.js"));
            });

            it("should record an error when a plugin command has no description", () => {
                // remove description property from a command definition
                const badPluginCmdDef: ICommandDefinition = JSON.parse(JSON.stringify(goodPluginCmdDef));
                delete badPluginCmdDef.children[1].description;

                // Ensure we get to the function that we want to validate
                mocks.existsSync.mockReturnValue(true);

                PMF.validatePluginCmdDefs(pluginName, [badPluginCmdDef], 1);

                expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(true);
                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain(
                    "Name = 'bar (at depth = 2)' has no 'description' property");
            });
        }); // end validate plugin cmd tree

        describe("Validate a plugin's profile", () => {

            it("should record an error when the profiles are null", () => {
                const pluginProfiles: ICommandProfileTypeConfiguration[] = null;

                PMF.validatePluginProfiles(pluginName, pluginProfiles);
                expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(true);
                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain(
                    "The plugin's existing 'profiles' property is empty.");
            });

            it("should record an error when the profiles are empty", () => {
                const pluginProfiles: ICommandProfileTypeConfiguration[] = [];

                PMF.validatePluginProfiles(pluginName, pluginProfiles);
                expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(true);
                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain(
                    "The plugin's existing 'profiles' property is empty.");
            });

            it("should record an error when multiple profiles have the same type", () => {
                const pluginProfiles: ICommandProfileTypeConfiguration[] = [
                    {
                        type: "sameTypeValue",
                        schema: {
                            type: "object",
                            title: "First schema",
                            description: "First description",
                            properties: {
                                size: {
                                    optionDefinition: {
                                        description: "size description",
                                        type: "string",
                                        name: "size", aliases: ["s"],
                                        required: true
                                    },
                                    type: "string",
                                }
                            }
                        }
                    },
                    {
                        type: "differentTypeValue",
                        schema: {
                            type: "object",
                            title: "Second schema",
                            description: "Second description",
                            properties: {
                                size: {
                                    optionDefinition: {
                                        description: "size description",
                                        type: "string",
                                        name: "size", aliases: ["s"],
                                        required: true
                                    },
                                    type: "string",
                                }
                            }
                        }
                    },
                    {
                        type: "sameTypeValue",
                        schema: {
                            type: "object",
                            title: "Third schema",
                            description: "Third description",
                            properties: {
                                size: {
                                    optionDefinition: {
                                        description: "size description",
                                        type: "string",
                                        name: "size", aliases: ["s"],
                                        required: true
                                    },
                                    type: "string",
                                }
                            }
                        }
                    }
                ];

                PMF.validatePluginProfiles(pluginName, pluginProfiles);
                expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(true);
                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain(
                    "The plugin's profiles at indexes = '0' and '2' have the same 'type' property = 'sameTypeValue'.");
            });

            it("should record an error a plugin profile type already exists among imperative profiles", () => {
                const pluginProfiles: ICommandProfileTypeConfiguration[] = [
                    {
                        type: "strawberry",
                        schema: {
                            type: "object",
                            title: "duplicate type",
                            description: "strawberry is known to exist in our testData",
                            properties: {
                                size: {
                                    optionDefinition: {
                                        description: "size description",
                                        type: "string",
                                        name: "size", aliases: ["s"],
                                        required: true
                                    },
                                    type: "string",
                                }
                            }
                        }
                    }
                ];

                PMF.validatePluginProfiles(pluginName, pluginProfiles);
                expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(true);
                const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
                expect(issue.issueSev).toBe(IssueSeverity.ERROR);
                expect(issue.issueText).toContain(
                    "The plugin's profile type = 'strawberry' already exists within existing profiles.");
            });

            it("should succeed when imperative has no profiles", () => {
                const goodConfigToRestore = impCfg.loadedConfig;
                impCfg.loadedConfig.profiles = [];

                const pluginProfiles: ICommandProfileTypeConfiguration[] = [
                    {
                        type: "uniqueTypeValue",
                        schema: {
                            type: "object",
                            title: "Some title",
                            description: "some description",
                            properties: {
                                size: {
                                    optionDefinition: {
                                        description: "size description",
                                        type: "string",
                                        name: "size", aliases: ["s"],
                                        required: true
                                    },
                                    type: "string",
                                }
                            }
                        }
                    }
                ];

                PMF.validatePluginProfiles(pluginName, pluginProfiles);
                expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(false);

                impCfg.loadedConfig = goodConfigToRestore;
            });

            it("should succeed when imperative has no conflicting profiles", () => {
                const pluginProfiles: ICommandProfileTypeConfiguration[] = [
                    {
                        type: "uniqueTypeValue",
                        schema: {
                            type: "object",
                            title: "Some title",
                            description: "some description",
                            properties: {
                                size: {
                                    optionDefinition: {
                                        description: "size description",
                                        type: "string",
                                        name: "size", aliases: ["s"],
                                        required: true
                                    },
                                    type: "string",
                                }
                            }
                        }
                    }
                ];

                PMF.validatePluginProfiles(pluginName, pluginProfiles);
                expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(false);
            });
        }); // end validate plugin profile
    }); // end plugin validation

    describe("Read plugin config", () => {
        let realCfgLoad: any;
        let realGetCliCmdName: any;
        let realGetCliPkgName: any;
        const mockCfgLoad = jest.fn();
        const mockGetCliCmdName = jest.fn();
        const mockGetCliPkgName = jest.fn();

        beforeEach(() => {
            realCfgLoad = ConfigurationLoader.load;
            ConfigurationLoader.load = mockCfgLoad;

            realGetCliCmdName = PMF.getCliCmdName;
            PMF.getCliCmdName = mockGetCliCmdName;

            realGetCliPkgName = PMF.getCliPkgName;
            PMF.getCliPkgName = mockGetCliPkgName;
        });

        afterEach(() => {
            ConfigurationLoader.load = realCfgLoad;
            PMF.getCliCmdName = realGetCliCmdName;
            PMF.getCliPkgName = realGetCliPkgName;
        });

        it("should record an error when the path to the plugin does not exist", () => {
            mocks.existsSync.mockReturnValue(false);

            const loadedCmdDefs = PMF.readPluginConfig(pluginName);

            expect(loadedCmdDefs).toBe(null);
            expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(true);
            const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
            expect(issue.issueSev).toBe(IssueSeverity.ERROR);
            expect(issue.issueText).toContain(
                "The path to the plugin does not exist: " +
                join(PMFConstants.instance.PLUGIN_NODE_MODULE_LOCATION, "sample-plugin"));
        });

        it("should record an error when plugin's package.json does not exist", () => {
            mocks.existsSync
                .mockReturnValueOnce(true)
                .mockReturnValueOnce(false);

            const loadedCmdDefs = PMF.readPluginConfig(pluginName);

            expect(loadedCmdDefs).toBe(null);
            expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(true);
            const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
            expect(issue.issueSev).toBe(IssueSeverity.ERROR);
            expect(issue.issueText).toContain(
                "Configuration file does not exist: '" +
                join(PMFConstants.instance.PLUGIN_NODE_MODULE_LOCATION, "sample-plugin/package.json") + "'");
        });

        it("should record an error when readFileSync throws an error", () => {
            // Ensure we get to the function that we want to test
            mocks.existsSync.mockReturnValue(true);

            // simulate an I/O error trying to read package.json
            mocks.readFileSync.mockImplementationOnce(() => {
                throw new Error("Mock I/O error");
            });

            const loadedCmdDefs = PMF.readPluginConfig(pluginName);

            expect(loadedCmdDefs).toBe(null);
            expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(true);
            const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
            expect(issue.issueSev).toBe(IssueSeverity.ERROR);
            expect(issue.issueText).toContain(
                "Cannot read '" +
                join(PMFConstants.instance.PLUGIN_NODE_MODULE_LOCATION, "sample-plugin/package.json") +
                "' Reason = Mock I/O error");
        });

        it("should record an error when package.json contains no 'imperative' property", () => {
            // Ensure we get to the function that we want to test
            mocks.existsSync.mockReturnValue(true);
            mocks.readFileSync.mockReturnValueOnce({
                name: "imperative-sample-plugin",
                version: "1.0.1",
                description: "Some description"
            });

            const loadedCmdDefs = PMF.readPluginConfig(pluginName);

            expect(loadedCmdDefs).toBe(null);
            expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(true);
            const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
            expect(issue.issueSev).toBe(IssueSeverity.WARNING);
            expect(issue.issueText).toContain("dependencies must be contained within a 'peerDependencies' property");
            expect(issue.issueText).toContain("property does not exist in the file " +
                "'" + join(PMFConstants.instance.PLUGIN_NODE_MODULE_LOCATION, "sample-plugin/package.json") + "'.");
        });

        it("should record return null when ConfigurationLoader throws an exception", () => {
            // Ensure we get to the function that we want to test
            mocks.existsSync.mockReturnValue(true);
            const pluginCfg = {
                name: "sample-plugin"
            };
            mocks.readFileSync.mockReturnValueOnce({
                name: "imperative-sample-plugin",
                version: "1.0.1",
                description: "Some description",
                imperative: pluginCfg
            });
            mockCfgLoad.mockImplementationOnce(() => {
                throw new Error("Mock load error");
            });

            // this is what we are really testing
            const loadedPluginCfg = PMF.readPluginConfig(pluginName);
            expect(loadedPluginCfg).toEqual(null);
        });

        it("should record warning when defined CLI package name does not existed in 'peerDependencies'", () => {
            // Ensure we get to the function that we want to test
            mocks.existsSync.mockReturnValue(true);
            const pluginCfg = {
                name: "sample-plugin"
            };
            mocks.readFileSync.mockReturnValueOnce({
                name: "imperative-sample-plugin",
                version: "1.0.1",
                description: "Some description",
                imperative: pluginCfg,
                peerDependencies: {
                    "@brightside/imperative": "dummyImperative"
                }
            });

            mockGetCliPkgName.mockReturnValue("nonExisting");
            mockGetCliCmdName.mockReturnValue("testCliName");
            mockCfgLoad.mockReturnValue(pluginCfg);

            // this is what we are really testing
            const loadedPluginCfg = PMF.readPluginConfig(pluginName);

            expect(loadedPluginCfg).toEqual(pluginCfg);
            expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(false);
            expect(pluginIssues.getIssueListForPlugin(pluginName).length).toBe(1);
            const recoredIssue = pluginIssues.getIssueListForPlugin(pluginName)[0];
            expect(recoredIssue.issueSev).toBe(IssueSeverity.WARNING);
            expect(recoredIssue.issueText).toContain("The property 'nonExisting' does not exist within the 'peerDependencies' property");
        });

        it("should return a plugin config when there are no errors", () => {
            // Ensure we get to the function that we want to test
            mocks.existsSync.mockReturnValue(true);
            const pluginCfg = {
                name: "sample-plugin"
            };
            mocks.readFileSync.mockReturnValueOnce({
                name: "imperative-sample-plugin",
                version: "1.0.1",
                description: "Some description",
                imperative: pluginCfg,
                peerDependencies: {
                    "@brightside/imperative": "dummyImperative"
                }
            });

            mockGetCliPkgName.mockReturnValue("@brightside/imperative");
            mockGetCliCmdName.mockReturnValue("testCliName");
            mockCfgLoad.mockReturnValue(pluginCfg);

            // this is what we are really testing
            const loadedPluginCfg = PMF.readPluginConfig(pluginName);

            expect(loadedPluginCfg).toEqual(pluginCfg);
            expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(false);
            expect(pluginIssues.getIssueListForPlugin(pluginName).length).toBe(0);
        });
    }); // end Read plugin config

    describe("conflictingNameOrAlias function", () => {
        let groupName: string;
        let impCmdTree: ICommandDefinition;

        beforeEach(() => {
            impCmdTree = require("./impCmdTree.testData");
        });

        it("should return true when plugin groupName matches another top-level name", () => {
            groupName = "goodbye";
            const pluginCmdDef: ICommandDefinition = {
                name: groupName,
                description: "description",
                type: "group"
            };
            expect(PMF.conflictingNameOrAlias(pluginName, pluginCmdDef, impCmdTree.children[0]).hasConflict)
                .toBe(true);
        });

        it("should return true when plugin groupName matches another top-level name with only case differences", () => {
            groupName = "GOODbye";
            const pluginCmdDef: ICommandDefinition = {
                name: groupName,
                description: "Description",
                type: "group",
            };
            expect(PMF.conflictingNameOrAlias(pluginName, pluginCmdDef, impCmdTree.children[0]).hasConflict)
                .toBe(true);
        });

        it("should return true when plugin groupName matches a top-level alias", () => {
            const aliasInCmdTree = "MatchingAliasName";
            groupName = aliasInCmdTree;
            impCmdTree.children[0].aliases = ["NoConflict1", aliasInCmdTree, "NoConflict2"];
            const pluginCmdDef: ICommandDefinition = {
                name: aliasInCmdTree,
                description: "Description",
                type: "group",
            };
            expect(PMF.conflictingNameOrAlias(pluginName, pluginCmdDef, impCmdTree.children[0]).hasConflict)
                .toBe(true);
        });

        it("should return true when plugin groupName matches a top-level alias with only case differences", () => {
            const aliasInCmdTree = "DifferingCaseAliasName";
            groupName = aliasInCmdTree.toUpperCase();
            impCmdTree.children[0].aliases = ["NoConflict1", aliasInCmdTree, "NoConflict2"];
            const pluginCmdDef: ICommandDefinition = {
                name: groupName,
                description: "Description",
                type: "group",
            };
            expect(PMF.conflictingNameOrAlias(pluginName, pluginCmdDef, impCmdTree.children[0]).hasConflict)
                .toBe(true);
        });

        it("should return true when plugin alias matches a top-level alias", () => {
            const aliasInCmdTree = "MatchingAliasName";
            groupName = aliasInCmdTree;
            impCmdTree.children[0].aliases = ["NoConflict1", aliasInCmdTree, "NoConflict2"];
            const pluginCmdDef: ICommandDefinition = {
                name: "doesnotmatch", aliases: ["doesnotmatcheither", groupName],
                description: "Description",
                type: "group",
            };
            expect(PMF.conflictingNameOrAlias(pluginName, pluginCmdDef, impCmdTree.children[0]).hasConflict)
                .toBe(true);
        });

        it("should return true when plugin alias matches a top-level group", () => {
            const groupInCmdTree = "MatchingGroupName";
            impCmdTree.children[0].name = groupInCmdTree;
            const pluginCmdDef: ICommandDefinition = {
                name: "doesnotmatch", aliases: ["doesnotmatcheither", groupInCmdTree],
                description: "Description",
                type: "group",
            };
            expect(PMF.conflictingNameOrAlias(pluginName, pluginCmdDef, impCmdTree.children[0]).hasConflict)
                .toBe(true);
        });

        it("should return false when no conflict is found", () => {
            groupName = "sample-plugin";
            expect(PMF.conflictingNameOrAlias(pluginName, goodPluginCmdDef, impCmdTree.children[0]).hasConflict)
                .toBe(false);
        });
    }); // end conflictingNameOrAlias function

    describe("addPlugin function", () => {
        const realReadPluginConfig = PMF.readPluginConfig;
        const mockReadPluginConfig = jest.fn();

        const realCombineAllCmdDefs = DefinitionTreeResolver.combineAllCmdDefs;
        const mockCombineAllCmdDefs = jest.fn();

        const realValidatePlugin = PMF.validatePlugin;
        const mockValidatePlugin = jest.fn();

        const realAddProfiles = impCfg.addProfiles;
        const mockAddProfiles = jest.fn();

        beforeEach(() => {
            PMF.readPluginConfig = mockReadPluginConfig;
            DefinitionTreeResolver.combineAllCmdDefs = mockCombineAllCmdDefs;
            PMF.validatePlugin = mockValidatePlugin;
            impCfg.addProfiles = mockAddProfiles;
        });

        afterEach(() => {
            PMF.readPluginConfig = realReadPluginConfig;
            DefinitionTreeResolver.combineAllCmdDefs = realCombineAllCmdDefs;
            PMF.validatePlugin = realValidatePlugin;
            impCfg.addProfiles = realAddProfiles;
        });

        it("should not call combineAllCmdDefs if readPluginConfig fails", () => {
            // make readPluginConfig fail
            mockReadPluginConfig.mockReturnValue(null);

            PMF.addPlugin(pluginName);

            expect(mockReadPluginConfig).toHaveBeenCalledTimes(1);
            expect(mockCombineAllCmdDefs).toHaveBeenCalledTimes(0);
        });

        it("should record an error if combineAllCmdDefs throws an error", () => {
            // Ensure we get to the function that we want to test
            mockReadPluginConfig.mockReturnValue(goodPluginConfig);
            mockCombineAllCmdDefs.mockImplementationOnce(() => {
                throw new Error("Mock combineAllCmdDefs error");
            });

            PMF.addPlugin(pluginName);

            expect(mockCombineAllCmdDefs).toHaveBeenCalledTimes(1);
            const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
            expect(issue.issueSev).toBe(IssueSeverity.ERROR);
            expect(issue.issueText).toContain(
                "Failed to combine command definitions. Reason = Mock combineAllCmdDefs error");
        });

        it("should not call addCmdGrpToResolvedCliCmdTree if validatePlugin fails", () => {
            // Ensure we get to the function that we want to test
            mockReadPluginConfig.mockReturnValue(goodPluginConfig);

            // make validatePlugin fail
            mockValidatePlugin.mockReturnValue(false);

            PMF.addPlugin(pluginName);

            expect(mockValidatePlugin).toHaveBeenCalledTimes(1);
            expect(PMF.addCmdGrpToResolvedCliCmdTree).toHaveBeenCalledTimes(0);
        });

        it("should not call addProfiles with an empty set of profiles", () => {
            // Ensure we get to the function that we want to test
            const badPluginConfig = JSON.parse(JSON.stringify(goodPluginConfig));
            badPluginConfig.profiles = [];
            mockReadPluginConfig.mockReturnValue(badPluginConfig);
            mockValidatePlugin.mockReturnValue(true);

            // this is what we really want to test
            PMF.addPlugin(pluginName);
            expect(impCfg.addProfiles).toHaveBeenCalledTimes(0);
        });

        it("should record an error when addProfiles throws an exception", () => {
            // Ensure we get to the function that we want to test
            mockReadPluginConfig.mockReturnValue(goodPluginConfig);
            mockValidatePlugin.mockReturnValue(true);
            mockAddCmdGrpToResolvedCliCmdTree.mockReturnValue(true);

            mockAddProfiles.mockImplementationOnce(() => {
                throw new Error("Mock addProfiles error");
            });

            // this is what we really want to test
            PMF.addPlugin(pluginName);
            expect(impCfg.addProfiles).toHaveBeenCalledTimes(1);
            const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
            expect(issue.issueSev).toBe(IssueSeverity.ERROR);
            expect(issue.issueText).toContain("Failed to add profiles for the plug-in");
            expect(issue.issueText).toContain("Reason = Mock addProfiles error");
        });

        it("should call addCmdGrpToResolvedCliCmdTree and addProfiles with the proper parameters", () => {
            // Ensure we get to the function that we want to test
            mockReadPluginConfig.mockReturnValue(goodPluginConfig);
            mockValidatePlugin.mockReturnValue(true);
            mockAddCmdGrpToResolvedCliCmdTree.mockReturnValue(true);
            DefinitionTreeResolver.combineAllCmdDefs = realCombineAllCmdDefs;

            // this is what we really want to test
            PMF.addPlugin(pluginName);
            expect(PMF.addCmdGrpToResolvedCliCmdTree).toHaveBeenCalledWith(pluginName, goodPluginCmdDef);
            expect(impCfg.addProfiles).toHaveBeenCalledWith(goodPluginConfig.profiles);
        });
    }); // end addPlugin

    describe("addCmdGrpToResolvedCliCmdTree function", () => {
        const cmdGrpToAdd: ICommandDefinition = {
            name: "WeWantToAddThisCommandGrp",
            description: "Pick fruit",
            type: "group",
            children: [
                {
                    name: "pineapple",
                    description: "Pick a pineapple",
                    type: "command",
                    handler: "C:\\SomePathTo\\imperative-sample\\lib\\imperative/../commands/pick/PickPineappleHandler"
                }
            ]
        };

        beforeEach(() => {
            PMF.addCmdGrpToResolvedCliCmdTree = realAddCmdGrpToResolvedCliCmdTree;
        });

        it("should record an error when resolvedCliCmdTree is null", () => {
            PMF.resolvedCliCmdTree = null;
            const result = PMF.addCmdGrpToResolvedCliCmdTree(pluginName, cmdGrpToAdd);
            expect(result).toBe(false);
            const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
            expect(issue.issueSev).toBe(IssueSeverity.ERROR);
            expect(issue.issueText).toContain(
                "The resolved command tree was null. Imperative should have created an empty command definition array.");
        });

        it("should record an error when resolvedCliCmdTree' children property is null", () => {
            PMF.resolvedCliCmdTree = {name: "no children"};
            const result = PMF.addCmdGrpToResolvedCliCmdTree(pluginName, cmdGrpToAdd);
            expect(result).toBe(false);
            const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
            expect(issue.issueSev).toBe(IssueSeverity.ERROR);
            expect(issue.issueText).toContain(
                "The resolved command tree children was null. Imperative should have created an empty children array.");
        });

        it("should record an error when the command group already exists in resolvedCliCmdTree", () => {
            PMF.resolvedCliCmdTree = {
                name: "root",
                description: "root of CLI cmd tree",
                type: "group",
                children: [cmdGrpToAdd]
            };
            const result = PMF.addCmdGrpToResolvedCliCmdTree(pluginName, cmdGrpToAdd);
            expect(result).toBe(false);
            const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
            expect(issue.issueSev).toBe(IssueSeverity.ERROR);
            expect(issue.issueText).toContain(
                "The command group = '" + cmdGrpToAdd.name +
                "' already exists. Plugin management should have already rejected this plugin.");
        });

        it("should add a new command group that does not already exist", () => {
            PMF.resolvedCliCmdTree = {
                name: "root",
                description: "root of CLI cmd tree",
                type: "group",
                children: []
            };
            const result = PMF.addCmdGrpToResolvedCliCmdTree(pluginName, cmdGrpToAdd);
            expect(result).toBe(true);
            expect(pluginIssues.getIssueListForPlugin(pluginName).length).toBe(0);
            expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(false);
        });
    }); // end describe addCmdGrpToResolvedCliCmdTree

    describe("removeCmdGrpFromResolvedCliCmdTree", () => {
        const cmdGrpToDel: ICommandDefinition = {
            name: "WeWantToDeleteThisCommandGrp",
            description: "Pick fruit",
            type: "group",
            children: [
                {
                    name: "pineapple",
                    description: "Pick a pineapple",
                    type: "command",
                    handler: "C:\\SomePathTo\\imperative-sample\\lib\\imperative/../commands/pick/PickPineappleHandler"
                }
            ]
        };

        it("should do nothing when resolvedCliCmdTree is null", () => {
            PMF.resolvedCliCmdTree = null;
            PMF.removeCmdGrpFromResolvedCliCmdTree(cmdGrpToDel);
            expect("We did not crash.").toBeTruthy();
        });

        it("should do nothing when resolvedCliCmdTree has no children property", () => {
            PMF.resolvedCliCmdTree = {name: "no children"};
            PMF.removeCmdGrpFromResolvedCliCmdTree(cmdGrpToDel);
            expect("We did not crash.").toBeTruthy();
        });

        it("should do nothing when resolvedCliCmdTree is empty", () => {
            PMF.resolvedCliCmdTree = {name: "no children", children: []};
            PMF.removeCmdGrpFromResolvedCliCmdTree(cmdGrpToDel);
            expect("We did not crash.").toBeTruthy();
        });

        it("should do nothing when command def is not in the resolvedCliCmdTree", () => {
            PMF.resolvedCliCmdTree = {
                name: "cliCmdTree",
                description: "Root command of host CLI",
                type: "group",
                children: [
                    {
                        name: "ThecmdGrpToDeleteIsNotInResolvedCliCmdTree",
                        description: "Pick fruit",
                        type: "group",
                        children: [
                            {
                                name: "pineapple",
                                description: "Pick a pineapple",
                                type: "command",
                                handler: "C:\\SomePathTo\\imperative-sample\\lib\\imperative/../commands/pick/PickPineappleHandler"
                            }
                        ]
                    }
                ]
            };

            const lengthBeforeRemove = PMF.resolvedCliCmdTree.children.length;
            PMF.removeCmdGrpFromResolvedCliCmdTree(cmdGrpToDel);
            expect(PMF.resolvedCliCmdTree.children.length).toBe(lengthBeforeRemove);
        });

        it("should remove the command def when found in the resolvedCliCmdTree", () => {
            PMF.resolvedCliCmdTree = {
                name: "cliCmdTree",
                description: "Root command of host CLI",
                type: "group",
                children: [
                    {
                        name: "WeWantToDeleteThisCommandGrp",
                        description: "Pick fruit",
                        type: "group",
                        children: [
                            {
                                name: "pineapple",
                                description: "Pick a pineapple",
                                type: "command",
                                handler: "C:\\SomePathTo\\imperative-sample\\lib\\imperative/../commands/pick/PickPineappleHandler"
                            }
                        ]
                    },
                    {
                        name: "A Second Cmd Definition",
                        description: "Pick fruit",
                        type: "group",
                        children: [
                            {
                                name: "pineapple",
                                description: "Pick a pineapple",
                                type: "command",
                                handler: "C:\\SomePathTo\\imperative-sample\\lib\\imperative/../commands/pick/PickPineappleHandler"
                            }
                        ]
                    }
                ],
            };

            const lengthBeforeRemove = PMF.resolvedCliCmdTree.children.length;
            PMF.removeCmdGrpFromResolvedCliCmdTree(cmdGrpToDel);
            expect(PMF.resolvedCliCmdTree.children.length).toBe(lengthBeforeRemove - 1);
            expect(PMF.resolvedCliCmdTree.children[0].name).toBe("A Second Cmd Definition");
        });
    }); // end describe

    describe("addAllPlugins function", () => {
        const mockInstalledPlugins: IPluginJson = {
            firstPlugin: {package: "1", registry: "1", version: "1"},
            secondPlugin: {package: "2", registry: "2", version: "2"}
        };
        const mockAddPlugin = jest.fn();
        let realAddPlugin: any;

        beforeEach(() => {
            realAddPlugin = PMF.addPlugin;
            PMF.addPlugin = mockAddPlugin;
        });

        afterEach(() => {
            PMF.addPlugin = realAddPlugin;
        });

        it("should pass the proper data to addPlugin", () => {
            // mocking addPlugin function
            mocks.readFileSync.mockReturnValue(mockInstalledPlugins);

            PMF.addPluginsToHostCli(PMF.resolvedCliCmdTree);

            expect(mockAddPlugin).toHaveBeenCalledTimes(2);
            expect(mockAddPlugin.mock.calls[0][0]).toBe("firstPlugin");
            expect(mockAddPlugin.mock.calls[1][0]).toBe("secondPlugin");
        });
    }); // end addAllPlugins

    describe("formPluginRuntimePath function", () => {
        it("should an absolute path when a relative path is specified", () => {
            const relativePath = "./relative/path";

            const runtimePath = PMF.formPluginRuntimePath(pluginName, relativePath);
            expect(runtimePath).toBe(
                join(PMFConstants.instance.PLUGIN_NODE_MODULE_LOCATION, pluginName, relativePath));
            expect(pluginIssues.getIssueListForPlugin(pluginName).length).toBe(0);
            expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(false);
        });

        it("should return the same path when an absolute path is specified", () => {
            const absolutePath = "/absolute/path";

            const runtimePath = PMF.formPluginRuntimePath(pluginName, absolutePath);
            expect(runtimePath).toBe(absolutePath);
            expect(pluginIssues.getIssueListForPlugin(pluginName).length).toBe(0);
            expect(pluginIssues.doesPluginHaveError(pluginName)).toBe(false);
        });
    }); // end formPluginRuntimePath

    describe("requirePluginModule function", () => {
        const mockFormPluginRuntimePath = jest.fn();
        let realFormPluginRuntimePath: any;

        beforeEach(() => {
            realFormPluginRuntimePath = PMF.formPluginRuntimePath;
            PMF.formPluginRuntimePath = mockFormPluginRuntimePath;
        });

        afterEach(() => {
            PMF.formPluginRuntimePath = realFormPluginRuntimePath;
        });

        it("should return the exported content of a valid module", () => {
            const modulePath = __dirname + "/mockConfigModule";
            const mockContent = require(modulePath);
            mockFormPluginRuntimePath.mockReturnValue(modulePath);

            const moduleContent = PMF.requirePluginModule(modulePath);
            expect(moduleContent).toBe(mockContent);

        });

        it("should record an error when the module does not exist", () => {
            const modulePath = "/path/does/not/exist";
            mockFormPluginRuntimePath.mockReturnValue(modulePath);
            PMF.currPluginName = "PluginWithConfigModule";

            const moduleContent = PMF.requirePluginModule(modulePath);
            const issue = pluginIssues.getIssueListForPlugin(PMF.currPluginName)[0];
            expect(issue.issueSev).toBe(IssueSeverity.ERROR);
            expect(issue.issueText).toContain(
                "Unable to load the following module for plug-in");
        });
    }); // end formPluginRuntimePath

    describe("getCliCmdName function", () => {
        it("should return proper CLI CMD name defined in package.json file", () => {
            // getCallerPackageJson is a getter of a property, so mock the property
            Object.defineProperty(impCfg, "callerPackageJson", {
                configurable: true,
                get: jest.fn(() => {
                    return goodBaseCliPkgJson;
                })
            });

            const cliCmdName = PMF.getCliCmdName();
            expect(cliCmdName).toBe("sample-cli");
        });
        it("should return 'YourBaseCliName' when CLI CMD name is not defined in package.json file", () => {
            // getCallerPackageJson is a getter of a property, so mock the property
            Object.defineProperty(impCfg, "callerPackageJson", {
                configurable: true,
                get: jest.fn(() => {
                    return {};
                })
            });

            const cliCmdName = PMF.getCliCmdName();
            expect(cliCmdName).toBe("YourBaseCliName");
        });
    });

    describe("getCliPkgName function", () => {
        it("should return proper CLI package name defined in package.json file", () => {
            // getCallerPackageJson is a getter of a property, so mock the property
            Object.defineProperty(impCfg, "callerPackageJson", {
                configurable: true,
                get: jest.fn(() => {
                    return goodBaseCliPkgJson;
                })
            });

            const cliCmdName = PMF.getCliPkgName();
            expect(cliCmdName).toBe("imperative-sample");
        });
        it("should return 'NoNameInCliPkgJson' when CLI Package name is not defined in package.json file", () => {
            // getCallerPackageJson is a getter of a property, so mock the property
            Object.defineProperty(impCfg, "callerPackageJson", {
                configurable: true,
                get: jest.fn(() => {
                    return {};
                })
            });

            const cliCmdName = PMF.getCliPkgName();
            expect(cliCmdName).toBe("NoNameInCliPkgJson");
        });
    });

    describe("comparePluginVersionToCli function", () => {
        const realGetCliCmdName = PMF.getCliCmdName;
        const mockGetCliCmdName = jest.fn();

        beforeEach(() => {
            PMF.currPluginName = pluginName;
            PMF.semver.intersects = jest.fn();
            PMF.getCliCmdName = mockGetCliCmdName;
        });
        afterEach(() => {
            PMF.getCliCmdName = realGetCliCmdName;
        });
        it("should record no issue when version is compatible", () => {
            PMF.semver.intersects.mockReturnValueOnce(true);

            PMF.comparePluginVersionToCli("pluginVerPropNm", "pluginVerVal", "cliVerPropNm", "CliVerVal");

            expect(pluginIssues.getIssueListForPlugin(pluginName).length).toBe(0);
        });

        it("should record issue when exception threw by semver", () => {
            PMF.semver.intersects.mockImplementationOnce(() => {
                throw new Error("dummy error");
            });

            PMF.comparePluginVersionToCli("pluginVerPropNm", "pluginVerVal", "cliVerPropNm", "CliVerVal");

            const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
            expect(issue.issueSev).toBe(IssueSeverity.WARNING);
            expect(issue.issueText).toContain("Failed to compare the version value");
        });

        it("should record issue when unable to compare Plugin Version to CLi version", () => {
            PMF.comparePluginVersionToCli("pluginVerPropNm", "pluginVerVal", "cliVerPropNm", "CliVerVal");

            const issue = pluginIssues.getIssueListForPlugin(pluginName)[0];
            expect(issue.issueSev).toBe(IssueSeverity.WARNING);
            expect(issue.issueText).toContain("The version value");
            expect(issue.issueText).toContain("is incompatible with the version value");
        });

    });

}); // end plugin management facility
