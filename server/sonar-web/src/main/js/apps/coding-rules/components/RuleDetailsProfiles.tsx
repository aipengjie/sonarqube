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
import { Link } from 'react-router';
import RuleInheritanceIcon from './RuleInheritanceIcon';
import { Profile } from '../../../api/quality-profiles';
import { RuleActivation, RuleDetails } from '../../../app/types';
import { translate } from '../../../helpers/l10n';
import { getQualityProfileUrl } from '../../../helpers/urls';
import BuiltInQualityProfileBadge from '../../quality-profiles/components/BuiltInQualityProfileBadge';
import Tooltip from '../../../components/controls/Tooltip';
import SeverityHelper from '../../../components/shared/SeverityHelper';

interface Props {
  activations: RuleActivation[] | undefined;
  canWrite: boolean | undefined;
  organization: string | undefined;
  referencedProfiles: { [profile: string]: Profile };
  ruleDetails: RuleDetails;
}

interface State {
  loading: boolean;
}

export default class RuleDetailsProfiles extends React.PureComponent<Props, State> {
  mounted: boolean;

  componentDidMount() {
    this.mounted = true;
    this.fetchProfiles();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.ruleDetails.key !== this.props.ruleDetails.key) {
      this.fetchProfiles();
    }
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  fetchProfiles = () => {
    this.setState({ loading: true });
  };

  renderInheritedProfile = (activation: RuleActivation, profile: Profile) => {
    if (!profile.parentName) {
      return null;
    }
    const profilePath = getQualityProfileUrl(
      profile.parentName,
      profile.language,
      this.props.organization
    );
    return (
      <div className="coding-rules-detail-quality-profile-inheritance">
        {(activation.inherit === 'OVERRIDES' || activation.inherit === 'INHERITED') && (
          <>
            <RuleInheritanceIcon
              inheritance={activation.inherit}
              parentProfileName={profile.parentName}
              profileName={profile.name}
            />
            <Link className="link-base-color spacer-left" to={profilePath}>
              {profile.parentName}
            </Link>
          </>
        )}
      </div>
    );
  };

  renderSeverity = (activation: RuleActivation, parentActivation?: RuleActivation) => (
    <td className="coding-rules-detail-quality-profile-severity">
      <Tooltip overlay={translate('coding_rules.activation_severity')}>
        <span>
          <SeverityHelper severity={activation.severity} />
        </span>
      </Tooltip>
      {parentActivation !== undefined &&
        activation.severity !== parentActivation.severity && (
          <div className="coding-rules-detail-quality-profile-inheritance">
            {translate('coding_rules.original')} {translate('severity', parentActivation.severity)}
          </div>
        )}
    </td>
  );

  renderParameter = (param: { key: string; value: string }, parentActivation?: RuleActivation) => {
    const originalParam =
      parentActivation && parentActivation.params.find(p => p.key === param.key);
    const originalValue = originalParam && originalParam.value;

    return (
      <div className="coding-rules-detail-quality-profile-parameter" key={param.key}>
        <span className="key">{param.key}</span>
        <span className="sep">{': '}</span>
        <span className="value" title={param.value}>
          {param.value}
        </span>
        {parentActivation &&
          param.value !== originalValue && (
            <div className="coding-rules-detail-quality-profile-inheritance">
              {translate('coding_rules.original')} <span className="value">{originalValue}</span>
            </div>
          )}
      </div>
    );
  };

  renderParameters = (activation: RuleActivation, parentActivation?: RuleActivation) => (
    <td className="coding-rules-detail-quality-profile-parameters">
      {activation.params.map(param => this.renderParameter(param, parentActivation))}
    </td>
  );

  renderActions = (activation: RuleActivation, profile: Profile) => {
    const canEdit = profile.actions && profile.actions.edit && !profile.isBuiltIn;
    const { ruleDetails } = this.props;
    return (
      <td className="coding-rules-detail-quality-profile-actions">
        {canEdit && (
          <>
            {!ruleDetails.isTemplate && (
              <button className="coding-rules-detail-quality-profile-change">
                {translate('change_verb')}
              </button>
            )}
            {profile.parentKey ? (
              activation.inherit === 'OVERRIDES' && (
                <button className="coding-rules-detail-quality-profile-revert button-red spacer-left">
                  {translate('coding_rules.revert_to_parent_definition')}
                </button>
              )
            ) : (
              <button className="coding-rules-detail-quality-profile-deactivate button-red spacer-left">
                {translate('coding_rules.deactivate')}
              </button>
            )}
          </>
        )}
      </td>
    );
  };

  renderActivation = (activation: RuleActivation) => {
    const { activations = [], ruleDetails } = this.props;
    const profile = this.props.referencedProfiles[activation.qProfile];
    if (!profile) {
      return null;
    }

    const parentActivation = activations.find(x => x.qProfile === profile.parentKey);

    return (
      <tr key={profile.key}>
        <td className="coding-rules-detail-quality-profile-name">
          <Link to={getQualityProfileUrl(profile.name, profile.language, this.props.organization)}>
            {profile.name}
          </Link>
          {profile.isBuiltIn && <BuiltInQualityProfileBadge className="spacer-left" />}
          {this.renderInheritedProfile(activation, profile)}
        </td>

        {this.renderSeverity(activation, parentActivation)}
        {!ruleDetails.templateKey && this.renderParameters(activation, parentActivation)}
        {this.renderActions(activation, profile)}
      </tr>
    );
  };

  render() {
    const { activations = [], referencedProfiles, ruleDetails } = this.props;
    const canActivate = Object.values(referencedProfiles).some(profile =>
      Boolean(profile.actions && profile.actions.edit && profile.language === ruleDetails.lang)
    );

    return (
      <div className="js-rule-profiles coding-rule-section">
        <div className="coding-rules-detail-quality-profiles-section">
          <div className="coding-rule-section-separator" />

          <h3 className="coding-rules-detail-title">
            {translate('coding_rules.quality_profiles')}
          </h3>

          {canActivate && (
            <button id="coding-rules-quality-profile-activate" className="spacer-left">
              {translate('coding_rules.activate')}
            </button>
          )}

          {activations.length > 0 && (
            <table
              id="coding-rules-detail-quality-profiles"
              className="coding-rules-detail-quality-profiles width100">
              <tbody>{activations.map(this.renderActivation)}</tbody>
            </table>
          )}
        </div>
      </div>
    );
  }
}
