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
import { post, getJSON, RequestData, postJSON } from '../helpers/request';
import throwGlobalError from '../app/utils/throwGlobalError';
import { Rule, RuleDetails, RuleActivation } from '../app/types';

export interface GetRulesAppResponse {
  canWrite?: boolean;
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

export function getRuleDetails(parameters: {
  actives?: boolean;
  key: string;
  organization?: string;
}): Promise<{ actives?: RuleActivation[]; rule: RuleDetails }> {
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

export function updateRule(data: {
  key: string;
  markdown_description?: string;
  markdown_note?: string;
  name?: string;
  organization?: string;
  params?: string;
  remediation_fn_base_effort?: string;
  remediation_fn_type?: string;
  remediation_fy_gap_multiplier?: string;
  severity?: string;
  status?: string;
  tags?: string;
}): Promise<RuleDetails> {
  return postJSON('/api/rules/update', data).then(r => r.rule, throwGlobalError);
}
