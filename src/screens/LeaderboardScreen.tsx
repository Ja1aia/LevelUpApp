import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { getLeaderboard } from '../services/database';

interface LeaderboardScreenProps {
    userId: string;
    onBack: () => void;
}

interface LeaderboardUser {
    id: string;
    username: string;
    elo: number;
    avatar: string;
}

export default function LeaderboardScreen({ userId, onBack }: LeaderboardScreenProps) {
    const [users, setUsers] = useState<LeaderboardUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLeaderboard();
    }, []);

    const loadLeaderboard = async () => {
        setLoading(true);
        const { data, error } = await getLeaderboard(50);
        if (data) {
            setUsers(data);
        }
        setLoading(false);
    };

    const renderItem = ({ item, index }: { item: LeaderboardUser; index: number }) => {
        const rank = index + 1;
        const isCurrentUser = item.id === userId;

        let rankColor = '#666666';
        let rankBg = 'transparent';
        let rankIcon = null;

        if (rank === 1) {
            rankColor = '#FFD700'; // Gold
            rankIcon = '🥇';
        } else if (rank === 2) {
            rankColor = '#C0C0C0'; // Silver
            rankIcon = '🥈';
        } else if (rank === 3) {
            rankColor = '#CD7F32'; // Bronze
            rankIcon = '🥉';
        }

        return (
            <View style={[
                styles.itemContainer,
                isCurrentUser && styles.currentUserItem
            ]}>
                <View style={styles.rankContainer}>
                    {rankIcon ? (
                        <Text style={styles.rankIcon}>{rankIcon}</Text>
                    ) : (
                        <Text style={[styles.rankText, { color: rankColor }]}>#{rank}</Text>
                    )}
                </View>

                <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>{item.avatar || '👤'}</Text>
                </View>

                <View style={styles.userInfo}>
                    <Text style={[
                        styles.username,
                        isCurrentUser && styles.currentUserText
                    ]}>
                        {item.username}
                    </Text>
                </View>

                <View style={styles.eloContainer}>
                    <Text style={styles.eloText}>{item.elo}</Text>
                    <Text style={styles.eloLabel}>ELO</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Leaderboard</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.tableHeader}>
                    <Text style={[styles.headerText, { width: 50, textAlign: 'center' }]}>Rank</Text>
                    <Text style={[styles.headerText, { flex: 1, paddingLeft: 16 }]}>Player</Text>
                    <Text style={[styles.headerText, { width: 80, textAlign: 'right' }]}>Rating</Text>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={users}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        refreshing={loading}
                        onRefresh={loadLeaderboard}
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        backgroundColor: '#FFFFFF',
    },
    backButton: {
        padding: 8,
        width: 40,
        alignItems: 'center',
    },
    backButtonText: {
        fontSize: 24,
        color: '#1A1A1A',
        fontWeight: 'bold',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1A1A1A',
    },
    content: {
        flex: 1,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F5F5F5',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    headerText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#666666',
        textTransform: 'uppercase',
    },
    listContent: {
        paddingBottom: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    currentUserItem: {
        backgroundColor: '#E8F4FD',
    },
    rankContainer: {
        width: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#666666',
    },
    rankIcon: {
        fontSize: 20,
    },
    avatarContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F0F0F0',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 20,
    },
    userInfo: {
        flex: 1,
    },
    username: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    currentUserText: {
        color: COLORS.primary,
        fontWeight: 'bold',
    },
    eloContainer: {
        alignItems: 'flex-end',
        width: 80,
    },
    eloText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    eloLabel: {
        fontSize: 10,
        color: '#999999',
    },
});
