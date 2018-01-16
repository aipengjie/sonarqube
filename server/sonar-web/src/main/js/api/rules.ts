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
import { post, getJSON, RequestData } from '../helpers/request';
import throwGlobalError from '../app/utils/throwGlobalError';
import { Rule } from '../app/types';

export interface GetRulesAppResponse {
  repositories: Array<{ key: string; language: string; name: string }>;
}

export function getRulesApp(): Promise<GetRulesAppResponse> {
  return getJSON('/api/rules/app').catch(throwGlobalError);
}

export interface SearchRulesResponse {
  actives?: {
    [rule: string]: Array<{
      createdAt: string;
      inherit: string;
      params: any[];
      qProfile: string;
      severity: string;
    }>;
  };
  facets?: Array<{
    property: string;
    values: Array<{ count: number; val: string }>;
  }>;
  p: number;
  ps: number;
  rules: Rule[];
  total: number;
}

export function searchRules(data: RequestData): Promise<SearchRulesResponse> {
  return getJSON('/api/rules/search', data).catch(throwGlobalError);
}

export function takeFacet(response: any, property: string) {
  const facet = response.facets.find((facet: any) => facet.property === property);
  return facet ? facet.values : [];
}

export interface GetRuleDetailsParameters {
  actives?: boolean;
  key: string;
  organization?: string;
}

export function getRuleDetails(parameters: GetRuleDetailsParameters): Promise<any> {
  return getJSON('/api/rules/show', parameters).catch(throwGlobalError);
}

export function getRuleTags(parameters: {
  organization?: string;
  ps?: number;
  q: string;
}): Promise<string[]> {
  return getJSON('/api/rules/tags', parameters).then(r => r.tags, throwGlobalError);
}

export function deleteRule(parameters: { key: string }) {
  return post('/api/rules/delete', parameters).catch(throwGlobalError);
}
