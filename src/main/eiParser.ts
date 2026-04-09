export interface EiParserSettings {
    detailledWvW: boolean;
    computeDamageModifiers: boolean;
    parsePhases: boolean;
    skipFailedTries: boolean;
    anonymous: boolean;
    customTooShort: number;
    saveOutHTML: boolean;
    parseCombatReplay: boolean;
    lightTheme: boolean;
    rawTimelineArrays: boolean;
    singleThreaded: boolean;
    memoryLimit: number;
}

export const DEFAULT_EI_SETTINGS: EiParserSettings = {
    detailledWvW: true,
    computeDamageModifiers: true,
    parsePhases: true,
    skipFailedTries: false,
    anonymous: false,
    customTooShort: 2200,
    saveOutHTML: false,
    parseCombatReplay: false,
    lightTheme: false,
    rawTimelineArrays: true,
    singleThreaded: false,
    memoryLimit: 0,
};

function boolToConf(val: boolean): string {
    return val ? 'True' : 'False';
}

export function generateEiConf(settings: EiParserSettings, outLocation: string): string {
    const lines: string[] = [
        `SaveOutJSON=True`,
        `SaveOutHTML=${boolToConf(settings.saveOutHTML)}`,
        `SaveOutCSV=False`,
        `SaveOutTrace=False`,
        `CompressRaw=True`,
        `SaveAtOut=False`,
        `OutLocation=${outLocation}`,
        `DetailledWvW=${boolToConf(settings.detailledWvW)}`,
        `RawTimelineArrays=${boolToConf(settings.rawTimelineArrays)}`,
        `ComputeDamageModifiers=${boolToConf(settings.computeDamageModifiers)}`,
        `ParseCombatReplay=${boolToConf(settings.parseCombatReplay)}`,
        `ParsePhases=${boolToConf(settings.parsePhases)}`,
        `SingleThreaded=${boolToConf(settings.singleThreaded)}`,
        `SkipFailedTries=${boolToConf(settings.skipFailedTries)}`,
        `Anonymous=${boolToConf(settings.anonymous)}`,
        `ParseMultipleLogs=False`,
        `UploadToDPSReports=False`,
        `UploadToWingman=False`,
        `IndentJSON=False`,
        `MemoryLimit=${settings.memoryLimit}`,
        `CustomTooShort=${settings.customTooShort}`,
        `LightTheme=${boolToConf(settings.lightTheme)}`,
        `HtmlExternalScripts=False`,
    ];
    return lines.join('\n') + '\n';
}
