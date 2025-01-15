import { ScrollView } from "react-native";

const ParadiScrollView = ({ children, handleScroll }: { children: React.ReactNode, handleScroll: (event: any) => void }) => {
    return (
        <ScrollView 
            className='flex-1 bg-white' 
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
        >
            {children}
        </ScrollView>
    );
};

export default ParadiScrollView