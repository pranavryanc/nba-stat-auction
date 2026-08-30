import { useCallback, useMemo, useState } from 'react';
import type { Player, Position } from '../types';
import { eligibility } from '../lib/gameLogic';

export function useAuctionFilters(pool: Player[]) {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [positionFilter, setPositionFilter] = useState<'ALL' | Position>('ALL');
  const [maxPrice, setMaxPrice] = useState(80);
  const [sort, setSort] = useState('price-desc');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const teams = useMemo(() => [...new Set(pool.map(player => player.teamAbbreviation))].sort(), [pool]);

  const displayed = useMemo(() => {
    const normalizedSearch = search.toLowerCase();
    const list = pool.filter(player =>
      player.name.toLowerCase().includes(normalizedSearch)
      && (teamFilter === 'ALL' || player.teamAbbreviation === teamFilter)
      && (positionFilter === 'ALL' || eligibility(player).includes(positionFilter))
      && player.price <= maxPrice
    );

    return [...list].sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      if (sort === 'points') return b.points - a.points;
      if (sort === 'rebounds') return b.rebounds - a.rebounds;
      if (sort === 'assists') return b.assists - a.assists;
      if (sort === 'steals') return b.steals - a.steals;
      if (sort === 'blocks') return b.blocks - a.blocks;
      return a.name.localeCompare(b.name);
    });
  }, [pool, search, teamFilter, positionFilter, maxPrice, sort]);

  const resetAuctionFilters = useCallback(() => {
    setSearch('');
    setTeamFilter('ALL');
    setPositionFilter('ALL');
    setMaxPrice(80);
    setSort('price-desc');
    setMobileFiltersOpen(false);
  }, []);

  return {
    search,
    setSearch,
    teamFilter,
    setTeamFilter,
    positionFilter,
    setPositionFilter,
    maxPrice,
    setMaxPrice,
    sort,
    setSort,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    teams,
    displayed,
    resetAuctionFilters,
  };
}
