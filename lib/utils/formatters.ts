/**
 * Refined Project Name Formatting Rule
 * 
 * Logic:
 * 1. Split caseName by '-' and trim segments.
 * 2. If 2 segments:
 *    - Segment 1: Region/Location (e.g. "新北樹林")
 *    - Segment 2: Title (e.g. "立昌紙業")
 *    - Auxiliary Info: Extract core region from Segment 1 (e.g. "樹林")
 * 3. If 3 or more segments:
 *    - Segment 1: Region/Location (e.g. "桃園中壢")
 *    - Last Segment: Title (e.g. "余宅")
 *    - Second to Last Segment: Auxiliary Info (e.g. "旺澄能源")
 *    - Region: Extract core region from Segment 1 (e.g. "中壢")
 */
export function formatProjectName(caseName: string | null | undefined) {
    if (!caseName) return { title: '未命名專案', aux: null, region: null, full: '' };

    const segments = caseName.split('-').map(s => s.trim()).filter(Boolean);

    if (segments.length === 0) return { title: caseName, aux: null, region: null, full: caseName };

    const extractRegionName = (raw: string) => {
        // Remove city prefix like 新北, 桃園, 台中...
        const stripped = raw.replace(/^(新北|台北|桃園|台中|台南|高雄|新北市|台北市|桃園市|台中市|台南市|高雄市)/, '');
        // Match the next word which is usually the district (e.g. 樹林, 中壢)
        const match = stripped.match(/^([^-\s\(\)（）]+)/);
        if (match) return match[1].replace(/區$/, '');
        return raw; // Fallback to raw if no match
    };

    if (segments.length === 1) {
        return { title: segments[0], aux: null, region: null, full: caseName };
    }

    if (segments.length === 2) {
        const regionPart = segments[0];
        const title = segments[1];
        const region = extractRegionName(regionPart);
        return { 
            title: title, 
            aux: region, 
            region: region,
            full: caseName
        };
    }

    if (segments.length >= 3) {
        const regionPart = segments[0];
        const aux = segments[segments.length - 2];
        const title = segments[segments.length - 1];
        const region = extractRegionName(regionPart);

        return {
            title: title,
            aux: aux,
            region: region,
            full: caseName
        };
    }

    return { title: caseName, aux: null, region: null, full: caseName };
}
