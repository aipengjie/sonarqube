/*
 * SonarQube
 * Copyright (C) 2009-2018 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
import * as React from 'react';
import { Helmet } from 'react-helmet';
import * as PropTypes from 'prop-types';
import { keyBy } from 'lodash';
import * as key from 'keymaster';
import {
  Facets,
  Query,
  parseQuery,
  serializeQuery,
  areQueriesEqual,
  shouldRequestFacet,
  FacetKey,
  OpenFacets,
  getServerFacet,
  getAppFacet,
  Actives,
  getOpen
} from '../query';
import { searchRules, getRulesApp } from '../../../api/rules';
import { Paging, Rule } from '../../../app/types';
import ScreenPositionHelper from '../../../components/common/ScreenPositionHelper';
import { translate } from '../../../helpers/l10n';
import { RawQuery } from '../../../helpers/query';
import ListFooter from '../../../components/controls/ListFooter';
import RuleListItem from './RuleListItem';
import PageActions from './PageActions';
import FiltersHeader from '../../../components/common/FiltersHeader';
import FacetsList from './FacetsList';
import { searchQualityProfiles, Profile } from '../../../api/quality-profiles';
import { scrollToElement } from '../../../helpers/scrolling';
import BulkChange from './BulkChange';
import RuleDetails from './RuleDetails';

const PAGE_SIZE = 100;

interface Props {
  location: { pathname: string; query: RawQuery };
  organization?: { key: string };
  organizationsEnabled?: boolean;
}

interface State {
  actives?: Actives;
  canWrite?: boolean;
  facets?: Facets;
  loading: boolean;
  openFacets: OpenFacets;
  openRule?: Rule;
  paging?: Paging;
  query: Query;
  referencedProfiles: { [profile: string]: Profile };
  referencedRepositories: { [repository: string]: { key: string; language: string; name: string } };
  rules: Rule[];
  selected?: string;
}

// TODO redirect to default organization's rules page

export default class App extends React.PureComponent<Props, State> {
  mounted: boolean;

  static contextTypes = {
    router: PropTypes.object.isRequired
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      loading: true,
      openFacets: { languages: false, types: false },
      query: parseQuery(props.location.query),
      referencedProfiles: {},
      referencedRepositories: {},
      rules: []
    };
  }

  componentDidMount() {
    this.mounted = true;
    document.body.classList.add('white-page');
    const footer = document.getElementById('footer');
    if (footer) {
      footer.classList.add('page-footer-with-sidebar');
    }
    this.attachShortcuts();
    this.fetchInitialData();
  }

  componentWillReceiveProps(nextProps: Props) {
    const openRule = this.getOpenRule(nextProps, this.state.rules);
    if (openRule && openRule.key !== this.state.selected) {
      this.setState({ selected: openRule.key });
    }
    this.setState({ openRule, query: parseQuery(nextProps.location.query) });
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (!areQueriesEqual(prevProps.location.query, this.props.location.query)) {
      this.fetchFirstRules();
    }
    if (
      !this.state.openRule &&
      (prevState.selected !== this.state.selected || prevState.openRule)
    ) {
      // if user simply selected another issue
      // or if he went from the source code back to the list of issues
      this.scrollToSelectedRule();
    }
  }

  componentWillUnmount() {
    this.mounted = false;
    document.body.classList.remove('white-page');
    const footer = document.getElementById('footer');
    if (footer) {
      footer.classList.remove('page-footer-with-sidebar');
    }
    this.detachShortcuts();
  }

  attachShortcuts = () => {
    key.setScope('coding-rules');
    key('up', 'coding-rules', () => {
      this.selectPreviousRule();
      return false;
    });
    key('down', 'coding-rules', () => {
      this.selectNextRule();
      return false;
    });
    key('right', 'coding-rules', () => {
      this.openSelectedRule();
      return false;
    });
    key('left', 'coding-rules', () => {
      this.closeRule();
      return false;
    });
  };

  detachShortcuts = () => {
    key.deleteScope('coding-rules');
  };

  getOpenRule = (props: Props, rules: Rule[]) => {
    const open = getOpen(props.location.query);
    return open && rules.find(rule => rule.key === open);
  };

  getFacetsToFetch = () => {
    return Object.keys(this.state.openFacets)
      .filter((facet: FacetKey) => this.state.openFacets[facet])
      .filter((facet: FacetKey) => shouldRequestFacet(facet))
      .map((facet: FacetKey) => getServerFacet(facet));
  };

  getFieldsToFetch = () => {
    const fields = [
      'isTemplate',
      'name',
      'lang',
      'langName',
      'severity',
      'status',
      'sysTags',
      'tags',
      'templateKey'
    ];
    if (this.state.query.profile) {
      fields.push('actives', 'params');
    }
    return fields;
  };

  getSearchParameters = () => ({
    f: this.getFieldsToFetch().join(),
    facets: this.getFacetsToFetch().join(),
    organization: this.props.organization && this.props.organization.key,
    ps: PAGE_SIZE,
    s: 'name',
    ...serializeQuery(this.state.query)
  });

  stopLoading = () => {
    if (this.mounted) {
      this.setState({ loading: false });
    }
  };

  fetchInitialData = () => {
    this.setState({ loading: true });
    Promise.all([
      getRulesApp(),
      searchQualityProfiles({
        organization: this.props.organization && this.props.organization.key
      })
    ]).then(([{ canWrite, repositories }, { profiles }]) => {
      this.setState({
        canWrite,
        referencedProfiles: keyBy(profiles, 'key'),
        referencedRepositories: keyBy(repositories, 'key')
      });
      this.fetchFirstRules();
    }, this.stopLoading);
  };

  makeFetchRequest = (query?: RawQuery) =>
    searchRules({ ...this.getSearchParameters(), ...query }).then(
      ({ actives: rawActives, facets: rawFacets, p, ps, rules, total }) => {
        const actives = rawActives && parseActives(rawActives);
        const facets = rawFacets && parseFacets(rawFacets);
        const paging = { pageIndex: p, pageSize: ps, total };
        return { actives, facets, paging, rules };
      }
    );

  fetchFirstRules = (query?: RawQuery) => {
    this.setState({ loading: true });
    this.makeFetchRequest(query).then(({ actives, facets, paging, rules }) => {
      if (this.mounted) {
        const openRule = this.getOpenRule(this.props, rules);
        const selected = rules.length > 0 ? (openRule && openRule.key) || rules[0].key : undefined;
        this.setState({ actives, facets, loading: false, openRule, paging, rules, selected });
      }
    }, this.stopLoading);
  };

  fetchMoreRules = () => {
    const { paging } = this.state;
    if (paging) {
      this.setState({ loading: true });
      const nextPage = paging.pageIndex + 1;
      this.makeFetchRequest({ p: nextPage, facets: undefined }).then(
        ({ actives, paging, rules }) => {
          if (this.mounted) {
            this.setState(state => ({
              actives: { ...state.actives, actives },
              loading: false,
              paging,
              rules: [...state.rules, ...rules]
            }));
          }
        },
        this.stopLoading
      );
    }
  };

  fetchFacet = (facet: FacetKey) => {
    this.setState({ loading: true });
    this.makeFetchRequest({ ps: 1, facets: getServerFacet(facet) }).then(({ facets }) => {
      if (this.mounted) {
        this.setState(state => ({ facets: { ...state.facets, ...facets }, loading: false }));
      }
    }, this.stopLoading);
  };

  getSelectedIndex = () => {
    const { selected, rules } = this.state;
    const index = rules.findIndex(rule => rule.key === selected);
    return index !== -1 ? index : undefined;
  };

  selectNextRule = () => {
    const { rules } = this.state;
    const selectedIndex = this.getSelectedIndex();
    if (rules && selectedIndex !== undefined && selectedIndex < rules.length - 1) {
      if (this.state.openRule) {
        this.openRule(rules[selectedIndex + 1].key);
      } else {
        this.setState({ selected: rules[selectedIndex + 1].key });
      }
    }
  };

  selectPreviousRule = () => {
    const { rules } = this.state;
    const selectedIndex = this.getSelectedIndex();
    if (rules && selectedIndex !== undefined && selectedIndex > 0) {
      if (this.state.openRule) {
        this.openRule(rules[selectedIndex - 1].key);
      } else {
        this.setState({ selected: rules[selectedIndex - 1].key });
      }
    }
  };

  openRule = (rule: string) => {
    const path = {
      pathname: this.props.location.pathname,
      query: {
        ...serializeQuery(this.state.query),
        open: rule
      }
    };
    if (this.state.openRule) {
      this.context.router.replace(path);
    } else {
      this.context.router.push(path);
    }
  };

  openSelectedRule = () => {
    const { selected } = this.state;
    if (selected) {
      this.openRule(selected);
    }
  };

  closeRule = () => {
    this.context.router.push({
      pathname: this.props.location.pathname,
      query: {
        ...serializeQuery(this.state.query),
        open: undefined
      }
    });
    this.scrollToSelectedRule(false);
  };

  scrollToSelectedRule = (smooth = true) => {
    const { selected } = this.state;
    if (selected) {
      const element = document.querySelector(`[data-rule="${selected}"]`);
      if (element) {
        scrollToElement(element, { topOffset: 150, bottomOffset: 100, smooth });
      }
    }
  };

  getRuleActivation = (rule: string) => {
    const { actives, query } = this.state;
    if (actives && actives[rule] && query.profile) {
      return actives[rule][query.profile];
    } else {
      return undefined;
    }
  };

  getSelectedProfile = () => {
    const { query, referencedProfiles } = this.state;
    if (query.profile) {
      return referencedProfiles[query.profile];
    } else {
      return undefined;
    }
  };

  handleReload = () => {
    this.fetchFirstRules();
  };

  handleFilterChange = (changes: Partial<Query>) => {
    this.context.router.push({
      pathname: this.props.location.pathname,
      query: serializeQuery({ ...this.state.query, ...changes })
    });
  };

  closeFacet = (facet: string) => {
    this.setState(state => ({
      openFacets: { ...state.openFacets, [facet]: false }
    }));
  };

  handleFacetToggle = (facet: keyof Query) => {
    this.setState(state => ({
      openFacets: { ...state.openFacets, [facet]: !state.openFacets[facet] }
    }));
    if (shouldRequestFacet(facet) && (!this.state.facets || !this.state.facets[facet])) {
      this.fetchFacet(facet);
    }
  };

  handleReset = () => {
    this.context.router.push({ pathname: this.props.location.pathname });
  };

  isFiltered = () => {
    const serialized = serializeQuery(this.state.query);
    return Object.keys(serialized).length > 0;
  };

  render() {
    const { paging, rules } = this.state;
    const selectedIndex = this.getSelectedIndex();

    return (
      <>
        <Helmet title={translate('coding_rules.page')} />
        <div className="layout-page" id="coding-rules-page">
          <ScreenPositionHelper className="layout-page-side-outer">
            {({ top }) => (
              <div className="layout-page-side" style={{ top }}>
                <div className="layout-page-side-inner">
                  <div className="layout-page-filters">
                    <FiltersHeader displayReset={this.isFiltered()} onReset={this.handleReset} />
                    <FacetsList
                      facets={this.state.facets}
                      onFacetToggle={this.handleFacetToggle}
                      onFilterChange={this.handleFilterChange}
                      organization={this.props.organization && this.props.organization.key}
                      openFacets={this.state.openFacets}
                      query={this.state.query}
                      referencedProfiles={this.state.referencedProfiles}
                      referencedRepositories={this.state.referencedRepositories}
                      selectedProfile={this.getSelectedProfile()}
                    />
                  </div>
                </div>
              </div>
            )}
          </ScreenPositionHelper>

          <div className="layout-page-main">
            <div className="layout-page-header-panel layout-page-main-header">
              <div className="layout-page-header-panel-inner layout-page-main-header-inner">
                <div className="layout-page-main-inner">
                  {this.state.paging && (
                    <BulkChange
                      query={this.state.query}
                      referencedProfiles={this.state.referencedProfiles}
                      total={this.state.paging.total}
                    />
                  )}
                  <PageActions
                    loading={this.state.loading}
                    onReload={this.handleReload}
                    paging={paging}
                    selectedIndex={selectedIndex}
                  />
                </div>
              </div>
            </div>

            <div className="layout-page-main-inner">
              {this.state.openRule ? (
                <RuleDetails
                  allowCustomRules={!this.props.organizationsEnabled}
                  canWrite={this.state.canWrite}
                  onFilterChange={this.handleFilterChange}
                  organization={this.props.organization && this.props.organization.key}
                  referencedRepositories={this.state.referencedRepositories}
                  ruleKey={this.state.openRule.key}
                />
              ) : (
                <>
                  {rules.map(rule => (
                    <RuleListItem
                      activation={this.getRuleActivation(rule.key)}
                      key={rule.key}
                      onClick={this.openRule}
                      onFilterChange={this.handleFilterChange}
                      rule={rule}
                      selected={rule.key === this.state.selected}
                      selectedProfile={this.getSelectedProfile()}
                    />
                  ))}
                  {paging !== undefined && (
                    <ListFooter
                      count={rules.length}
                      loadMore={this.fetchMoreRules}
                      ready={!this.state.loading}
                      total={paging.total}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }
}

function parseActives(rawActives: {
  [rule: string]: Array<{
    createdAt: string;
    inherit: string;
    params: any[];
    qProfile: string;
    severity: string;
  }>;
}) {
  const actives: Actives = {};
  for (const [rule, activations] of Object.entries(rawActives)) {
    actives[rule] = {};
    for (const { inherit, qProfile, severity } of activations) {
      actives[rule][qProfile] = { inherit, severity };
    }
  }
  return actives;
}

function parseFacets(
  rawFacets: Array<{
    property: string;
    values: Array<{ count: number; val: string }>;
  }>
) {
  const facets: Facets = {};
  for (const rawFacet of rawFacets) {
    const values: { [value: string]: number } = {};
    for (const rawValue of rawFacet.values) {
      values[rawValue.val] = rawValue.count;
    }
    facets[getAppFacet(rawFacet.property)] = values;
  }
  return facets;
}
