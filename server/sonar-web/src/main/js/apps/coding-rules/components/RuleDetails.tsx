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
import { getRuleDetails, updateRule } from '../../../api/rules';
import { RuleActivation, RuleDetails as IRuleDetails } from '../../../app/types';
import { translate } from '../../../helpers/l10n';
import LinkIcon from '../../../components/icons-components/LinkIcon';
import { getRuleUrl } from '../../../helpers/urls';
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

interface Props {
  allowCustomRules?: boolean;
  canWrite?: boolean;
  onFilterChange: (changes: Partial<Query>) => void;
  organization?: string;
  referencedRepositories: { [repository: string]: { key: string; language: string; name: string } };
  ruleKey: string;
}

interface State {
  actives?: RuleActivation[];
  extendedDescription: string;
  extendedDescriptionForm: boolean;
  extendingDescritption: boolean;
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
        }
      },
      () => {
        if (this.mounted) {
          this.setState({ loading: false });
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

  render() {
    const { ruleDetails } = this.state;

    if (!ruleDetails) {
      return <div className="coding-rule-details" />;
    }

    const { canWrite = false, referencedRepositories } = this.props;
    const { htmlDesc = '', sysTags = [], tags = [] } = ruleDetails;
    const allTags = [...sysTags, ...tags];

    const isCustom = !!ruleDetails.templateKey;
    const isEditable = canWrite && !!this.props.allowCustomRules && isCustom;

    const repository = referencedRepositories[ruleDetails.repo];

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

          <div className="js-rule-parameters" />

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

          <div className="js-rule-custom-rules coding-rule-section" />

          <div className="js-rule-profiles coding-rule-section" />

          <div className="js-rule-issues coding-rule-section" />
        </DeferredSpinner>
      </div>
    );
  }
}
