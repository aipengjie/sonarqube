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
import { Query } from '../query';
import { Profile } from '../../../api/quality-profiles';
import { getRuleDetails, updateRule, searchRules } from '../../../api/rules';
import { RuleActivation, RuleDetails as IRuleDetails, Rule } from '../../../app/types';
import BuiltInQualityProfileBadge from '../../quality-profiles/components/BuiltInQualityProfileBadge';
import { translate, translateWithParameters } from '../../../helpers/l10n';
import LinkIcon from '../../../components/icons-components/LinkIcon';
import { getRuleUrl, getQualityProfileUrl, getIssuesUrl } from '../../../helpers/urls';
import SimilarRulesFilter from './SimilarRulesFilter';
import Tooltip from '../../../components/controls/Tooltip';
import IssueTypeIcon from '../../../components/ui/IssueTypeIcon';
import SeverityHelper from '../../../components/shared/SeverityHelper';
import DateFormatter from '../../../components/intl/DateFormatter';
import DeferredSpinner from '../../../components/common/DeferredSpinner';
import TagsList from '../../../components/tags/TagsList';
import BubblePopupHelper from '../../../components/common/BubblePopupHelper';
import RuleDetailsTagsPopup from './RuleDetailsTagsPopup';
import MarkdownTips from '../../../components/common/MarkdownTips';
import RemoveExtendedDescriptionModal from './RemoveExtendedDescriptionModal';
import { getFacet } from '../../../api/issues';
import { formatMeasure } from '../../../helpers/measures';

interface Props {
  allowCustomRules?: boolean;
  canWrite?: boolean;
  onFilterChange: (changes: Partial<Query>) => void;
  organization?: string;
  referencedProfiles: { [profile: string]: Profile };
  referencedRepositories: { [repository: string]: { key: string; language: string; name: string } };
  ruleKey: string;
}

interface State {
  actives?: RuleActivation[];
  customRules?: Rule[];
  customRulesLoading?: boolean;
  extendedDescription: string;
  extendedDescriptionForm: boolean;
  extendingDescritption: boolean;
  issuesByProject?: Array<{ count: number; project?: { key: string; name: string }; val: string }>;
  issuesLoading?: boolean;
  issuesTotal?: number;
  loading: boolean;
  removeExtendedDescriptionModal: boolean;
  ruleDetails?: IRuleDetails;
  tagsPopup: boolean;
}

export default class RuleDetails extends React.PureComponent<Props, State> {
  mounted: boolean;
  state: State = {
    extendedDescription: '',
    extendedDescriptionForm: false,
    extendingDescritption: false,
    loading: true,
    removeExtendedDescriptionModal: false,
    tagsPopup: false
  };

  componentDidMount() {
    this.mounted = true;
    this.fetchRuleDetails();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.ruleKey !== this.props.ruleKey) {
      this.fetchRuleDetails();
    }
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  fetchRuleDetails = () => {
    this.setState({ loading: true });
    getRuleDetails({
      actives: true,
      key: this.props.ruleKey,
      organization: this.props.organization
    }).then(
      ({ actives, rule }) => {
        if (this.mounted) {
          this.setState({ actives, loading: false, ruleDetails: rule });
          if (rule.isTemplate) {
            this.fetchCustomRules();
          } else {
            this.fetchIssues();
          }
        }
      },
      () => {
        if (this.mounted) {
          this.setState({ loading: false });
        }
      }
    );
  };

  fetchCustomRules = () => {
    this.setState({ customRulesLoading: true });
    searchRules({
      /* eslint-disable camelcase */
      template_key: this.props.ruleKey,
      /* eslint-enable camelcase */
      f: 'name,severity,params'
    }).then(
      ({ rules }) => {
        if (this.mounted) {
          this.setState({ customRules: rules, customRulesLoading: false });
        }
      },
      () => {
        if (this.mounted) {
          this.setState({ customRulesLoading: false });
        }
      }
    );
  };

  fetchIssues = () => {
    this.setState({ issuesLoading: true });
    getFacet({ rules: this.props.ruleKey, resolved: false }, 'projectUuids').then(
      ({ facet, response }) => {
        if (this.mounted) {
          const issuesByProject = facet.map(item => {
            const project =
              response.components &&
              response.components.find(component => component.uuid === item.val);
            return { ...item, project };
          });
          this.setState({
            issuesByProject,
            issuesLoading: false,
            issuesTotal: response.paging.total
          });
        }
      },
      () => {
        if (this.mounted) {
          this.setState({ issuesLoading: false });
        }
      }
    );
  };

  handleTagsClick = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.blur();
    this.setState(state => ({ tagsPopup: !state.tagsPopup }));
  };

  handleTagsPopupToggle = (show: boolean) => {
    this.setState({ tagsPopup: show });
  };

  handleTagsChange = (tags: string[]) => {
    this.setState(state => ({ ruleDetails: { ...state.ruleDetails, tags } }));
  };

  handleExtendDescriptionClick = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.blur();
    this.setState(state => ({
      // set `extendedDescription` to the current `mdNote` each time the form is open
      extendedDescription: (state.ruleDetails && state.ruleDetails.mdNote) || '',
      extendedDescriptionForm: true
    }));
  };

  handleExtendedDescriptionChange = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const { value } = event.currentTarget;
    this.setState({ extendedDescription: value });
  };

  handleCancelExtendDescriptionClick = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.blur();
    this.setState({ extendedDescriptionForm: false });
  };

  handleSaveExtendedDescriptionClick = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.blur();
    this.updateExtendedDescription(this.state.extendedDescription);
  };

  handleRemoveExtendedDescriptionClick = (event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.blur();
    this.setState({ removeExtendedDescriptionModal: true });
  };

  handleCancelRemoveExtendedDescription = () => {
    this.setState({ removeExtendedDescriptionModal: false });
  };

  handleConfirmRemoveExtendedDescription = () => {
    this.setState({ removeExtendedDescriptionModal: false });
    this.updateExtendedDescription('');
  };

  updateExtendedDescription = (text: string) => {
    this.setState({ extendingDescritption: true });

    updateRule({
      key: this.props.ruleKey,
      /* eslint-disable camelcase */
      markdown_note: text,
      /* eslint-enable camelcase*/
      organization: this.props.organization
    }).then(
      ruleDetails => {
        if (this.mounted) {
          this.setState({
            extendingDescritption: false,
            extendedDescriptionForm: false,
            ruleDetails
          });
        }
      },
      () => {
        if (this.mounted) {
          this.setState({ extendingDescritption: false });
        }
      }
    );
  };

  renderActivation = (
    activation: RuleActivation,
    actives: RuleActivation[],
    ruleDetails: IRuleDetails
  ) => {
    const profile = this.props.referencedProfiles[activation.qProfile];
    if (!profile) {
      return null;
    }

    const parentActivation = actives.find(x => x.qProfile === profile.parentKey);
    const getOriginalValue = (key: string) => {
      const param = parentActivation && parentActivation.params.find(param => param.key === key);
      return param && param.value;
    };

    return (
      <tr key={profile.key}>
        <td className="coding-rules-detail-quality-profile-name">
          <Link to={getQualityProfileUrl(profile.name, profile.language, this.props.organization)}>
            {profile.name}
          </Link>
          {profile.isBuiltIn && <BuiltInQualityProfileBadge className="spacer-left" />}
          {profile.parentName !== undefined && (
            <div className="coding-rules-detail-quality-profile-inheritance">
              {activation.inherit === 'OVERRIDES' && (
                <i
                  className="icon-inheritance icon-inheritance-overridden"
                  title={translateWithParameters(
                    'coding_rules.overrides',
                    profile.name,
                    profile.parentName
                  )}
                />
              )}
              {activation.inherit === 'INHERITED' && (
                <i
                  className="icon-inheritance"
                  title={translateWithParameters(
                    'coding_rules.inherits',
                    profile.name,
                    profile.parentName
                  )}
                />
              )}
              {['OVERRIDES', 'INHERITED'].includes(activation.inherit) && (
                <Link
                  className="link-base-color spacer-left"
                  to={getQualityProfileUrl(
                    profile.parentName,
                    profile.language,
                    this.props.organization
                  )}>
                  {profile.parentName}
                </Link>
              )}
            </div>
          )}
        </td>
        {activation.severity ? (
          <>
            <td className="coding-rules-detail-quality-profile-severity">
              {/* TODO l10n */}
              <Tooltip overlay="Activation severity">
                <span>
                  <SeverityHelper severity={activation.severity} />
                </span>
              </Tooltip>
              {parentActivation !== undefined &&
                parentActivation.severity !== undefined &&
                activation.severity !== parentActivation.severity && (
                  <div className="coding-rules-detail-quality-profile-inheritance">
                    {translate('coding_rules.original')}{' '}
                    {translate('severity', parentActivation.severity)}
                  </div>
                )}
            </td>
            {ruleDetails.templateKey === undefined && (
              <td className="coding-rules-detail-quality-profile-parameters">
                {activation.params.map(param => (
                  <div className="coding-rules-detail-quality-profile-parameter" key={param.key}>
                    <span className="key">{param.key}</span>
                    <span className="sep">:&nbsp;</span>
                    <span className="value" title={param.value}>
                      {param.value}
                    </span>
                    {parentActivation &&
                      param.value !== getOriginalValue(param.key) && (
                        <div className="coding-rules-detail-quality-profile-inheritance">
                          {translate('coding_rules.original')}&nbsp;<span className="value">
                            {getOriginalValue(param.key)}
                          </span>
                        </div>
                      )}
                  </div>
                ))}
              </td>
            )}
            <td className="coding-rules-detail-quality-profile-actions">
              {profile.actions &&
                profile.actions.edit &&
                !profile.isBuiltIn && (
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
          </>
        ) : (
          // TODO is this case possible?
          this.props.canWrite &&
          !ruleDetails.isTemplate && (
            <td className="coding-rules-detail-quality-profile-actions">
              <button className="coding-rules-detail-quality-profile-activate">
                {translate('coding_rules.activate')}
              </button>
            </td>
          )
        )}
      </tr>
    );
  };

  render() {
    const { actives, customRules, customRulesLoading, ruleDetails } = this.state;

    if (!ruleDetails) {
      return <div className="coding-rule-details" />;
    }

    const {
      allowCustomRules,
      canWrite = false,
      referencedProfiles,
      referencedRepositories
    } = this.props;
    const { htmlDesc = '', params = [], sysTags = [], tags = [] } = ruleDetails;
    const allTags = [...sysTags, ...tags];

    const isCustom = !!ruleDetails.templateKey;
    const isEditable = canWrite && !!this.props.allowCustomRules && isCustom;

    const repository = referencedRepositories[ruleDetails.repo];

    const canActivate = Object.values(referencedProfiles).some(profile =>
      Boolean(profile.actions && profile.actions.edit && profile.language === ruleDetails.lang)
    );

    return (
      <div className="coding-rule-details">
        <DeferredSpinner loading={this.state.loading}>
          <div className="js-rule-meta">
            <header className="page-header">
              <div className="pull-right">
                <span className="note text-middle">{ruleDetails.key}</span>
                <Link
                  className="coding-rules-detail-permalink link-no-underline spacer-left text-middle"
                  target="_blank"
                  to={getRuleUrl(ruleDetails.key)}>
                  <LinkIcon />
                </Link>
                <SimilarRulesFilter onFilterChange={this.props.onFilterChange} rule={ruleDetails} />
              </div>
              <h3 className="page-title coding-rules-detail-header">
                <big>{ruleDetails.name}</big>
              </h3>
            </header>

            <ul className="coding-rules-detail-properties">
              <Tooltip overlay={translate('coding_rules.type.tooltip', ruleDetails.type)}>
                <li className="coding-rules-detail-property">
                  <IssueTypeIcon className="little-spacer-right" query={ruleDetails.type} />
                  {translate('issue.type', ruleDetails.type)}
                </li>
              </Tooltip>

              <Tooltip overlay={translate('default_severity')}>
                <li className="coding-rules-detail-property">
                  <SeverityHelper severity={ruleDetails.severity} />
                </li>
              </Tooltip>

              {ruleDetails.status !== 'READY' && (
                <Tooltip overlay={translate('status')}>
                  <li className="coding-rules-detail-property">
                    <span className="badge badge-normal-size badge-danger-light">
                      {translate('rules.status', ruleDetails.status)}
                    </span>
                  </li>
                </Tooltip>
              )}

              <li className="coding-rules-detail-property">
                {canWrite ? (
                  <BubblePopupHelper
                    isOpen={this.state.tagsPopup}
                    position="bottomleft"
                    popup={
                      <RuleDetailsTagsPopup
                        organization={this.props.organization}
                        setTags={this.handleTagsChange}
                        sysTags={sysTags}
                        tags={tags}
                      />
                    }
                    togglePopup={this.handleTagsPopupToggle}>
                    <button className="button-link" onClick={this.handleTagsClick}>
                      <TagsList
                        allowUpdate={canWrite}
                        tags={allTags.length > 0 ? allTags : [translate('coding_rules.no_tags')]}
                      />
                    </button>
                  </BubblePopupHelper>
                ) : (
                  <TagsList
                    allowUpdate={canWrite}
                    tags={allTags.length > 0 ? allTags : [translate('coding_rules.no_tags')]}
                  />
                )}
              </li>

              <li className="coding-rules-detail-property">
                {translate('coding_rules.available_since')}{' '}
                <DateFormatter date={ruleDetails.createdAt} />
              </li>

              <Tooltip overlay={translate('coding_rules.repository_language')}>
                <li className="coding-rules-detail-property">
                  {repository && repository.name} ({ruleDetails.langName})
                </li>
              </Tooltip>

              {ruleDetails.isTemplate && (
                <Tooltip overlay={translate('coding_rules.rule_template.title')}>
                  <li className="coding-rules-detail-property">
                    {translate('coding_rules.rule_template')}
                  </li>
                </Tooltip>
              )}

              {ruleDetails.templateKey !== undefined && (
                <Tooltip overlay={translate('coding_rules.custom_rule.title')}>
                  <li className="coding-rules-detail-property">
                    {translate('coding_rules.custom_rule')}
                    {' ('}
                    <Link to={getRuleUrl(ruleDetails.templateKey)}>
                      {translate('coding_rules.show_template')}
                    </Link>
                    {')'}
                  </li>
                </Tooltip>
              )}

              {ruleDetails.debtRemFnType !== undefined && (
                <Tooltip overlay={translate('coding_rules.remediation_function')}>
                  <li className="coding-rules-detail-property">
                    {translate('coding_rules.remediation_function', ruleDetails.debtRemFnType)}
                    {':'}
                    {ruleDetails.debtRemFnOffset !== undefined && ` ${ruleDetails.debtRemFnOffset}`}
                    {ruleDetails.debtRemFnCoeff !== undefined && ` +${ruleDetails.debtRemFnCoeff}`}
                    {ruleDetails.effortToFixDescription !== undefined &&
                      ` ${ruleDetails.effortToFixDescription}`}
                  </li>
                </Tooltip>
              )}
            </ul>
          </div>

          <div className="js-rule-description">
            <div
              className="coding-rules-detail-description rule-desc markdown"
              dangerouslySetInnerHTML={{ __html: htmlDesc }}
            />

            {!ruleDetails.isCustom && (
              <div className="coding-rules-detail-description coding-rules-detail-description-extra">
                {!this.state.extendedDescriptionForm && (
                  <div id="coding-rules-detail-description-extra">
                    {ruleDetails.htmlNote !== undefined && (
                      <div
                        className="rule-desc spacer-bottom markdown"
                        dangerouslySetInnerHTML={{ __html: ruleDetails.htmlNote }}
                      />
                    )}
                    {canWrite && (
                      <button
                        id="coding-rules-detail-extend-description"
                        onClick={this.handleExtendDescriptionClick}>
                        {translate('coding_rules.extend_description')}
                      </button>
                    )}
                  </div>
                )}

                {canWrite &&
                  this.state.extendedDescriptionForm && (
                    <div className="coding-rules-detail-extend-description-form">
                      <table className="width100">
                        <tbody>
                          <tr>
                            <td className="width100" colSpan={2}>
                              <textarea
                                autoFocus={true}
                                id="coding-rules-detail-extend-description-text"
                                onChange={this.handleExtendedDescriptionChange}
                                rows={4}
                                style={{ width: '100%', marginBottom: 4 }}
                                value={this.state.extendedDescription}
                              />
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <button
                                disabled={this.state.extendingDescritption}
                                id="coding-rules-detail-extend-description-submit"
                                onClick={this.handleSaveExtendedDescriptionClick}>
                                {translate('save')}
                              </button>
                              {ruleDetails.mdNote !== undefined && (
                                <>
                                  <button
                                    className="button-red spacer-left"
                                    disabled={this.state.extendingDescritption}
                                    id="coding-rules-detail-extend-description-remove"
                                    onClick={this.handleRemoveExtendedDescriptionClick}>
                                    {translate('remove')}
                                  </button>
                                  {this.state.removeExtendedDescriptionModal && (
                                    <RemoveExtendedDescriptionModal
                                      onCancel={this.handleCancelRemoveExtendedDescription}
                                      onSubmit={this.handleConfirmRemoveExtendedDescription}
                                    />
                                  )}
                                </>
                              )}
                              <button
                                className="spacer-left button-link"
                                disabled={this.state.extendingDescritption}
                                id="coding-rules-detail-extend-description-cancel"
                                onClick={this.handleCancelExtendDescriptionClick}>
                                {translate('cancel')}
                              </button>
                              {this.state.extendingDescritption && (
                                <i className="spinner spacer-left" />
                              )}
                            </td>
                            <td className="text-right">
                              <MarkdownTips />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            )}
          </div>

          {params.length > 0 && (
            <div className="js-rule-parameters">
              <h3 className="coding-rules-detail-title">{translate('coding_rules.parameters')}</h3>
              <table className="coding-rules-detail-parameters">
                <tbody>
                  {params.map(param => (
                    <tr className="coding-rules-detail-parameter" key={param.key}>
                      <td className="coding-rules-detail-parameter-name">{param.key}</td>
                      <td className="coding-rules-detail-parameter-description">
                        <p dangerouslySetInnerHTML={{ __html: param.htmlDesc || '' }} />
                        {ruleDetails.templateKey !== undefined ? (
                          <div className="note spacer-top">
                            {param.defaultValue ? (
                              <span className="coding-rules-detail-parameter-value">
                                {param.defaultValue}
                              </span>
                            ) : (
                              translate('coding_rules.parameter.empty')
                            )}
                          </div>
                        ) : (
                          !!param.defaultValue && (
                            <div className="note spacer-top">
                              {translate('coding_rules.parameters.default_value')}
                              <br />
                              <span className="coding-rules-detail-parameter-value">
                                {param.defaultValue}
                              </span>
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isEditable && (
            <div className="coding-rules-detail-description">
              <button className="js-edit-custom" id="coding-rules-detail-custom-rule-change">
                {translate('edit')}
              </button>
              <button className="button-red js-delete" id="coding-rules-detail-rule-delete">
                {translate('delete')}
              </button>
            </div>
          )}

          {ruleDetails.isTemplate && (
            <div className="js-rule-custom-rules coding-rule-section">
              <div className="coding-rules-detail-custom-rules-section">
                <div className="coding-rule-section-separator" />

                <h3 className="coding-rules-detail-title">
                  {translate('coding_rules.custom_rules')}
                </h3>

                {allowCustomRules &&
                  canWrite && (
                    <button className="js-create-custom-rule spacer-left">
                      {translate('coding_rules.create')}
                    </button>
                  )}

                <DeferredSpinner loading={customRulesLoading}>
                  {customRules &&
                    customRules.length > 0 && (
                      <table
                        id="coding-rules-detail-custom-rules"
                        className="coding-rules-detail-list">
                        <tbody>
                          {customRules.map(customRule => (
                            <tr key={customRule.key}>
                              <td className="coding-rules-detail-list-name">
                                <Link to={getRuleUrl(customRule.key, this.props.organization)}>
                                  {customRule.name}
                                </Link>
                              </td>

                              <td className="coding-rules-detail-list-severity">
                                <SeverityHelper severity={customRule.severity} />
                              </td>

                              <td className="coding-rules-detail-list-parameters">
                                {customRule.params &&
                                  customRule.params
                                    .filter(param => param.defaultValue)
                                    .map(param => (
                                      <div
                                        className="coding-rules-detail-list-parameter"
                                        key={param.key}>
                                        <span className="key">{param.key}</span>
                                        <span className="sep">:&nbsp;</span>
                                        <span className="value" title={param.defaultValue}>
                                          {param.defaultValue}
                                        </span>
                                      </div>
                                    ))}
                              </td>

                              {allowCustomRules &&
                                canWrite && (
                                  <td className="coding-rules-detail-list-actions">
                                    <button className="js-delete-custom-rule button-red">
                                      {translate('delete')}
                                    </button>
                                  </td>
                                )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                </DeferredSpinner>
              </div>
            </div>
          )}

          {!ruleDetails.isTemplate && (
            <div className="js-rule-profiles coding-rule-section">
              <div className="coding-rules-detail-quality-profiles-section">
                <div className="coding-rule-section-separator" />

                <h3 className="coding-rules-detail-title">
                  {translate('coding_rules.quality_profiles')}
                </h3>

                {canActivate &&
                  !ruleDetails.isTemplate && (
                    <button id="coding-rules-quality-profile-activate" className="spacer-left">
                      {translate('coding_rules.activate')}
                    </button>
                  )}

                {actives &&
                  actives.length > 0 && (
                    <table
                      id="coding-rules-detail-quality-profiles"
                      className="coding-rules-detail-quality-profiles width100">
                      <tbody>
                        {actives.map(activation =>
                          this.renderActivation(activation, actives, ruleDetails)
                        )}
                      </tbody>
                    </table>
                  )}
              </div>
            </div>
          )}

          {!ruleDetails.isTemplate && (
            <div className="js-rule-issues coding-rule-section">
              <div className="coding-rule-section-separator" />

              {this.state.issuesLoading ? (
                <h3 className="coding-rules-detail-title">
                  {translate('coding_rules.issues')} <i className="spinner spacer-left" />
                </h3>
              ) : (
                <>
                  <h3 className="coding-rules-detail-title">
                    {translate('coding_rules.issues')}{' '}
                    {this.state.issuesTotal !== undefined && (
                      <>
                        (<Link
                          to={getIssuesUrl(
                            { resolved: 'false', rules: ruleDetails.key },
                            this.props.organization
                          )}>
                          {this.state.issuesTotal}
                        </Link>)
                      </>
                    )}
                  </h3>

                  {this.state.issuesByProject &&
                    this.state.issuesByProject.length > 0 && (
                      <table className="coding-rules-detail-list coding-rules-most-violated-projects">
                        <tbody>
                          <tr>
                            <td className="coding-rules-detail-list-name" colSpan={2}>
                              {translate('coding_rules.most_violating_projects')}
                            </td>
                          </tr>
                          {this.state.issuesByProject.map(item => (
                            <tr key={item.val}>
                              <td className="coding-rules-detail-list-name">
                                {item.project ? item.project.name : item.val}
                              </td>
                              <td className="coding-rules-detail-list-parameters">
                                <Link
                                  to={getIssuesUrl(
                                    {
                                      projectUuids: item.val,
                                      resolved: 'false',
                                      rules: ruleDetails.key
                                    },
                                    this.props.organization
                                  )}>
                                  {formatMeasure(item.count, 'INT')}
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                </>
              )}
            </div>
          )}
        </DeferredSpinner>
      </div>
    );
  }
}
