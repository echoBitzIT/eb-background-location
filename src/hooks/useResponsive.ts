import { useWindowDimensions } from "react-native";

const TABLET_MIN_WIDTH = 768;

export const useResponsive = () => {
    const { width, height } = useWindowDimensions();
    const isTablet = Math.min(width, height) >= TABLET_MIN_WIDTH;
    const isLandscape = width > height;
    
    return  {
        width,
        height,
        isTablet,
        isLandscape,
        // max content width on tablet so UI doesn't stretch too wide
        contentMaxWidth: isTablet ? 480 : width,
    };
};